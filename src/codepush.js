import { execute, getPackageJson, readFile, select, writeFile } from './utils';
import { trim } from 'lodash';

const fs = require('fs');
const plist = require('plist');
const program = require('commander');
const open = require('open');

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

const getIosName = async () => {
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

  return name;
};

const runIos = async center_key => {
  if (!center_key) {
    console.warn('[ios] ==> Not found Key ');
    return false;
  }

  let codepushKey;
  try {
    console.log('[ios] Get a codepush key...');

    const cmd = `appcenter codepush deployment list -a ${center_key} --displayKeys`;
    const { stdout } = await execute(cmd);

    codepushKey = getCodePushKey(stdout, 'Production');
    if (!codepushKey) {
      console.log('[ios] ==> First initalize to appcenter.ms');
      const s = center_key.split('/');
      open(
        `https://appcenter.ms/orgs/${s[0]}/apps/${s[1]}/distribute/code-push`,
      );
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

const runAndroid = async center_key => {
  if (!center_key) {
    console.warn('[and] ==> Not found Key [ appcenter_and ] ');
    return false;
  }

  let codepushKey;
  try {
    console.log('[and] Get a codepush key...');

    const cmd = `appcenter codepush deployment list -a ${center_key} --displayKeys`;
    const { stdout } = await execute(cmd);

    codepushKey = getCodePushKey(stdout, 'Production');
    if (!codepushKey) {
      console.log('[and] ==> First initalize to appcenter.ms');
      const s = center_key.split('/');
      open(
        `https://appcenter.ms/orgs/${s[0]}/apps/${s[1]}/distribute/code-push`,
      );
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
  await runIos(file.codepush.ios);
  await runAndroid(file.codepush.and);
  return file.codepush;
};

const App = async (pkgs, argv) => {
  let pkgVer = null;
  const file = await getPackageJson(async pkg => {
    pkgVer = pkg.version;
    if (Object.keys(pkg.dependencies).indexOf('react-native-code-push') < 0) {
      console.log('install to codepush...');
      await execute(
        'npm i react-native-code-push && pod install --project-directory=./ios',
      );
    }
  });

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
    !file?.codepush?.and || keys.indexOf(file?.codepush?.and) < 0;
  const noKeyIos =
    !file?.codepush?.ios || keys.indexOf(file?.codepush?.ios) < 0;

  const etcOpt = {
    name: 'Project not found! (Go to AppCenter)',
    value: '@@project_not_founded',
  };

  if (noKeyAnd || noKeyIos) {
    const orgData = await select(
      'Select the AppCenter Organization.',
      orgs.concat([etcOpt]),
    );

    if (orgData.value === etcOpt.value) {
      console.log('Move to Appcenter ');
      open('https://appcenter.ms/apps');
      process.exit(0);
    } else {
      if (noKeyIos) {
        const keyData = await select(
          'Select the AppCenter key for iOS.',
          keys.filter(v => v.startsWith(orgData.value)).concat([etcOpt]),
        );
        if (keyData.value === etcOpt.value) {
          console.log('Move to Appcenter ');
          open(`https://appcenter.ms/orgs/${orgData.value}/applications`);
          process.exit(0);
        }

        if (!file.codepush) file.codepush = {};
        file.codepush.ios = keyData.value;
      }

      if (noKeyAnd) {
        const keyData = await select(
          'Select the AppCenter key for Android.',
          keys.filter(v => v.startsWith(orgData.value)).concat([etcOpt]),
        );

        if (keyData.value === etcOpt.value) {
          console.log('Move to Appcenter ');
          open(`https://appcenter.ms/orgs/${orgData.value}/applications`);
          process.exit(0);
        }

        if (!file.codepush) file.codepush = {};
        file.codepush.and = keyData.value;
      }
    }
  }

  if (!file?.codepush || argv.reset) {
    file.codepush = await install(file);
    const text = JSON.stringify(file, null, 2);
    await writeFile('./actbase.json', text);
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

    file.version++;
    const text = JSON.stringify(file, null, 2);
    await writeFile('./actbase.json', text);

    if (device.startsWith('ios') || device.startsWith('all')) {
      try {
        // iOS or All
        const name = await getIosName();
        const appPlist = plist.parse(
          await readFile(`./ios/${name}/Info.plist`),
        );

        let args = '';
        if (
          appPlist.CFBundleShortVersionString?.indexOf('MARKETING_VERSION') > 0
        ) {
          const f = await readFile(`./ios/${name}.xcodeproj/project.pbxproj`);
          const vs = f
            .split('\n')
            .filter(v => v.indexOf('MARKETING_VERSION') >= 0);
          if (vs.length > 0) {
            let s = vs[vs.length - 1];
            s = s.substring(s.indexOf('=') + 2);
            s = s.substring(0, s.length - 1);
            args = ` --target-binary-version ${s} `;
          }
        }

        console.log('Create a iOS.');
        await execute(`rm -rf build_ios`);
        await execute(
          `appcenter codepush release-react -a ${file.codepush.ios} -d ${profile} ${args} --output-dir build_ios`,
        );

        if (file.bugsnag) {
          const cmd = `bugsnag-sourcemaps upload --api-key ${file.bugsnag}
         --source-map build_ios/CodePush/main.jsbundle.map
         --minified-file build_ios/CodePush/main.jsbundle
         --minified-url main.jsbundle
         --upload-sources
         --add-wildcard-prefix
         --code-bundle-id ${pkgVer}-${file.version}`;

          await execute(cmd);
        }

        await execute(`rm -rf build_ios`);
        console.log('Finish a iOS.');
      } catch (e) {
        console.log('Failure a iOS.');
        console.log(e);
      }
    }

    if (device.startsWith('and') || device.startsWith('all')) {
      try {
        // Android or All
        console.log('Create a Android.');
        await execute(`rm -rf build_and`);
        await execute(
          `appcenter codepush release-react -a ${file.codepush.and} -d ${profile} --output-dir build_and`,
        );

        if (file.bugsnag) {
          const cmd = `bugsnag-sourcemaps upload --api-key ${file.bugsnag}
          --source-map build_and/CodePush/index.android.bundle.map
          --minified-file build_and/CodePush/index.android.bundle
          --minified-url index.android.bundle
          --upload-sources
          --add-wildcard-prefix
          --code-bundle-id ${pkgVer}-${file.version}`;

          await execute(cmd);
        }

        await execute(`rm -rf build_and`);
        console.log('Finish a Android.');
      } catch (e) {
        console.log('Failure a Android.');
        console.log(e);
      }
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
