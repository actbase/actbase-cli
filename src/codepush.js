import { readFile, writeFile, execute, getPackageJson, select } from './utils';
import { trim } from 'lodash';

const fs = require('fs');
const plist = require('plist');
const program = require('commander');
const cliSelect = require('cli-select');
const chalk = require('chalk');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

const getCodePushKey = (stdout, key) => {
  let str = '';
  stdout.split('\n').map(line => {
    if (line.indexOf(key) >= 0) {
      line = line.substring(line.indexOf('│') + 1);
      line = line.substring(line.indexOf('│') + 1);
      line = line.substring(line.indexOf(' ') + 1);
      line = line.substring(0, line.indexOf(' '));
      str = line;
    }
  });
  return str;
};

const runIos = async file => {
  if (!file.appcenter_ios) {
    console.warn('[ios] ==> Not found Key [ appcenter_ios ] ');
    return false;
  }

  let codepushKey;
  try {
    console.log('[ios] Get a codepush key...');

    const cmd = `appcenter codepush deployment list -a ${file.appcenter_ios} --displayKeys`;
    const { stdout } = await execute(cmd);

    codepushKey = getCodePushKey(stdout, 'Production');
    if (!codepushKey) {
      console.log('[ios] ==> First initalize to appcenter.ms');
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }

  const podfile = await readFile('./ios/Podfile');
  const podfileRows = podfile.split('\n');

  let name = '';
  for (let i = 0; i < podfileRows.length; i++) {
    if (podfileRows[i].startsWith("target '")) {
      name = podfileRows[i];
      name = name.substring(name.indexOf("'") + 1);
      name = name.substring(0, name.indexOf("'"));
      break;
    }
  }

  try {
    const appPlist = plist.parse(await readFile(`./ios/${name}/Info.plist`));
    if (!appPlist.CodePushDeploymentKey) {
      console.log('[ios] Edit to Info.plist ');
      appPlist.CodePushDeploymentKey = codepushKey;

      const tDomains = [
        'codepush.appcenter.ms',
        'codepush.blob.core.windows.net',
        'codepushupdates.azureedge.net',
      ];
      const domains = appPlist.NSAppTransportSecurity.NSExceptionDomains;
      tDomains.forEach(d => {
        if (!domains[d]) {
          domains[d] = { NSExceptionAllowsInsecureHTTPLoads: true };
        }
      });

      appPlist.NSAppTransportSecurity.NSExceptionDomains = domains;
      await writeFile(`./ios/${name}/Info.plist`, plist.build(appPlist));
    }
  } catch (e) {
    console.error(e);
    return false;
  }

  let applied = false;
  const appDelegate = (await readFile(`./ios/${name}/AppDelegate.m`)).split(
    '\n',
  );
  appDelegate.forEach(v => {
    if (!applied && v.indexOf('CodePush/CodePush.h') >= 0) {
      applied = true;
    }
  });

  if (!applied) {
    console.log('[ios] Edit to AppDelegate.m ');

    const index1 = appDelegate.findIndex(
      v => v.indexOf('@implementation AppDelegate') >= 0,
    );
    appDelegate.splice(index1, 0, '#import <CodePush/CodePush.h>');
    appDelegate.splice(index1 + 1, 0, '');

    const index2 = appDelegate.findIndex(
      v => v.indexOf('URLForResource:@"main" withExtension:@"jsbundle"') >= 0,
    );
    appDelegate.splice(index2, 1, '  return [CodePush bundleURL];');
    await writeFile(`./ios/${name}/AppDelegate.m`, appDelegate.join('\n'));
  }

  console.log('[ios] Finished..! ');
  return true;
};

const runAndroid = async file => {
  if (!file.appcenter_and) {
    console.warn('[and] ==> Not found Key [ appcenter_and ] ');
    return false;
  }

  let codepushKey;
  try {
    console.log('[and] Get a codepush key...');

    const cmd = `appcenter codepush deployment list -a ${file.appcenter_and} --displayKeys`;
    const { stdout } = await execute(cmd);

    codepushKey = getCodePushKey(stdout, 'Production');
    if (!codepushKey) {
      console.log('[and] ==> First initalize to appcenter.ms');
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }

  //

  let applied1 = false;
  const stringXml = (
    await readFile(`./android/app/src/main/res/values/strings.xml`)
  ).split('\n');
  stringXml.forEach(v => {
    if (!applied1 && v.indexOf('name="CodePushDeploymentKey"') >= 0) {
      applied1 = true;
    }
  });

  if (!applied1) {
    console.log('[and] Edit to strings.xml ');

    const index1 = stringXml.findIndex(v => v.indexOf('name="app_name"') >= 0);
    stringXml.splice(
      index1 + 1,
      0,
      `    <string moduleConfig="true" name="CodePushDeploymentKey">${codepushKey}</string>`,
    );

    await writeFile(
      `./android/app/src/main/res/values/strings.xml`,
      stringXml.join('\n'),
    );
  }

  let applied2 = false;
  const buildGradle = (await readFile(`./android/app/build.gradle`)).split(
    '\n',
  );
  buildGradle.forEach(v => {
    if (
      !applied2 &&
      v.indexOf('react-native-code-push/android/codepush.gradle') >= 0
    ) {
      applied2 = true;
    }
  });

  if (!applied2) {
    console.log('[and] Edit to build.gradle ');

    const index1 = buildGradle.findIndex(v =>
      v.startsWith(
        'apply from: "../../node_modules/react-native/react.gradle"',
      ),
    );
    buildGradle.splice(
      index1 + 1,
      0,
      `apply from: "../../node_modules/react-native-code-push/android/codepush.gradle"`,
    );

    await writeFile(`./android/app/build.gradle`, buildGradle.join('\n'));
  }

  let pkgname = buildGradle.find(v => v.indexOf('applicationId') >= 0);
  pkgname = pkgname.substring(pkgname.indexOf('"') + 1);
  pkgname = pkgname.substring(0, pkgname.indexOf('"'));
  pkgname = pkgname.replace(/\./g, '/');

  let applied3 = false;
  const mainApplicationJava = (
    await readFile(
      `./android/app/src/main/java/${pkgname}/MainApplication.java`,
    )
  ).split('\n');
  mainApplicationJava.forEach(v => {
    if (!applied3 && v.indexOf('CodePush.getJSBundleFile();') >= 0) {
      applied3 = true;
    }
  });

  if (!applied3) {
    console.log('[and] Edit to MainApplication.java ');

    const index1 = mainApplicationJava.findIndex(
      v => v.indexOf('new ReactNativeHost(this)') >= 0,
    );
    mainApplicationJava.splice(index1 + 1, 0, ` @Override`);
    mainApplicationJava.splice(
      index1 + 2,
      0,
      ` protected String getJSBundleFile() {`,
    );
    mainApplicationJava.splice(
      index1 + 3,
      0,
      `   return CodePush.getJSBundleFile();`,
    );
    mainApplicationJava.splice(index1 + 4, 0, ` }`);

    const index2 = mainApplicationJava.findIndex(
      v => v.indexOf('public class MainApplication') >= 0,
    );
    mainApplicationJava.splice(
      index2,
      0,
      `import com.microsoft.codepush.react.CodePush;`,
    );
    mainApplicationJava.splice(index2 + 1, 0, ``);

    await writeFile(
      `./android/app/src/main/java/${pkgname}/MainApplication.java`,
      mainApplicationJava.join('\n'),
    );
  }

  console.log('[and] Finished..! ');
  return true;
};

const install = async file => {
  console.log('Initalized to Codepush');
  if (Object.keys(file.dependencies).indexOf('react-native-code-push') < 0) {
    console.log('install to codepush...');
    await execute(
      'npm i react-native-code-push && pod install --project-directory=./ios',
    );
  }

  const ios = await runIos(file);
  const and = await runAndroid(file);

  return { ios, and };
};

const App = async (pkgs, argv) => {
  const file = await getPackageJson();

  console.log('Waiting for AppCenter response...');

  const cmd = `appcenter apps list`;
  const { stdout } = await execute(cmd);
  const orgs = [];
  const keys = stdout
    .split('\n')
    .filter(v => v)
    .map(v => {
      const str = trim(v);
      const org = str.substr(0, str.indexOf('/'));
      if (orgs.indexOf(org) < 0) orgs.push(org);
      return str;
    });

  const noKeyAnd =
    !file?.appcenter_and || keys.indexOf(file?.appcenter_and) < 0;
  const noKeyIos =
    !file?.appcenter_ios || keys.indexOf(file?.appcenter_ios) < 0;

  if (noKeyAnd || noKeyIos) {
    const orgData = await select('Select the AppCenter Organization.', orgs);
    if (noKeyAnd) {
      const keyData = await select(
        'Select the AppCenter key for Android.',
        keys.filter(v => v.startsWith(orgData.value)),
      );
      file.appcenter_and = keyData;
      file.actbase.codepush = null;
    }

    if (noKeyIos) {
      const keyData = await select(
        'Select the AppCenter key for iOS.',
        keys.filter(v => v.startsWith(orgData.value)),
      );
      file.appcenter_ios = keyData;
      file.actbase.codepush = null;
    }
  }

  if (!file?.actbase?.codepush || argv.reset) {
    file.actbase.codepush = await install(file);
    const text = JSON.stringify(file, null, 2);
    await writeFile('./package.json', text);
  } else {
    const profile = argv.profile || 'Production';

    let device = argv.device;
    if (!device) {
      const selected = await select(
        'On which platform do you want to deploy?',
        ['All Device', 'iOS', 'Android'],
      );
      device = selected.value.toLowerCase();
    }

    if (
      !device.startsWith('ios') &&
      !device.startsWith('and') &&
      device.indexOf('all') < 0
    ) {
      console.log('Not found platforms.');
      process.exit(1);
    }

    const version = file.version;
    let last = parseInt(version.substring(version.lastIndexOf('.') + 1)) + 1;

    file.version = version.substring(0, version.lastIndexOf('.') + 1) + last;
    const text = JSON.stringify(file, null, 2);
    await writeFile('./package.json', text);

    if (!device.startsWith('and')) {
      // iOS or All
      await execute(`rm -rf build_ios`);
      await execute(
        `appcenter codepush release-react -a ${file.appcenter_ios} -d ${profile} --output-dir build_ios`,
      );

      if (file.bugsnag) {
        const cmd = `bugsnag-sourcemaps upload --api-key ${file.bugsnag}
         --source-map build_ios/CodePush/main.jsbundle.map 
         --minified-file build_ios/CodePush/main.jsbundle 
         --minified-url main.jsbundle 
         --upload-sources 
         --add-wildcard-prefix 
         --code-bundle-id ${file.version}`;

        await execute(cmd);
      }

      await execute(`rm -rf build_ios`);
    }

    if (!device.startsWith('ios')) {
      // Android or All
      await execute(`rm -rf build_and`);
      await execute(
        `appcenter codepush release-react -a ${file.appcenter_and} -d ${profile} --output-dir build_and`,
      );

      if (file.bugsnag) {
        const cmd = `bugsnag-sourcemaps upload --api-key ${file.bugsnag} 
          --source-map build_and/CodePush/index.android.bundle.map 
          --minified-file build_and/CodePush/index.android.bundle 
          --minified-url index.android.bundle 
          --upload-sources 
          --add-wildcard-prefix 
          --code-bundle-id ${file.version}`;

        await execute(cmd);
      }

      await execute(`rm -rf build_and`);
    }
  }
};

program
  .option('-r, --reset', 'reset latest file.')
  .option('-P, --profile <profile>', 'Profile')
  .option('-D, --device <device>', 'Device (All, iOS, Android)')
  .parse(process.argv);

var pkgs = program.args;
App(pkgs, program.opts());
