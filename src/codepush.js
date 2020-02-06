
import { readFile, writeFile, execute } from './utils';

const fs = require('fs');
const plist = require('plist');
const program = require('commander');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}


const getCodePushKey = (stdout, key) => {
  let str = '';
  stdout.split('\n').map(line => {
    if (line.indexOf(key) >= 0) {
      line = line.substring(line.indexOf("│") + 1);
      line = line.substring(line.indexOf("│") + 1);
      line = line.substring(line.indexOf(" ") + 1);
      line = line.substring(0, line.indexOf(" "));
      str = line;
    }
  });
  return str;
};


const runIos = async (file) => {

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

  }
  catch(e) {
    
  }

  const podfile = await readFile('./ios/Podfile');
  const podfileRows = podfile.split('\n');

  let name = '';
  for (let i = 0; i < podfileRows.length; i++) {
    if (podfileRows[i].startsWith('target \'')) {
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

      const tDomains = ['codepush.appcenter.ms', 'codepush.blob.core.windows.net', 'codepushupdates.azureedge.net'];
      const domains = appPlist.NSAppTransportSecurity.NSExceptionDomains;
      tDomains.forEach(d => {
        if (!domains[d]) {
          domains[d] = { NSExceptionAllowsInsecureHTTPLoads: true };
        }
      })

      appPlist.NSAppTransportSecurity.NSExceptionDomains = domains;
      await writeFile(`./ios/${name}/Info.plist`, plist.build(appPlist));
    }
  }
  catch(e) {

  }
   
  let applied = false;
  const appDelegate = (await readFile(`./ios/${name}/AppDelegate.m`)).split('\n');
  appDelegate.forEach(v => {
    if (!applied && v.indexOf('CodePush/CodePush.h') >= 0) {
      applied = true;
    }
  });

  if (!applied) {
    console.log('[ios] Edit to AppDelegate.m ');

    const index1 = appDelegate.findIndex(v => v.indexOf('@implementation AppDelegate') >= 0);
    appDelegate.splice(index1, 0, '#import <CodePush/CodePush.h>');
    appDelegate.splice(index1 + 1, 0, '');

    const index2 = appDelegate.findIndex(v => v.indexOf('URLForResource:@"main" withExtension:@"jsbundle"') >= 0);
    appDelegate.splice(index2, 1, '  return [CodePush bundleURL];');
    await writeFile(`./ios/${name}/AppDelegate.m`, appDelegate.join("\n"));
  }

  console.log('[ios] Finished..! ');
  return true;
}

const runAndroid = async (file) => {

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

  }
  catch(e) {
    
  }

  //

  let applied1 = false;
  const stringXml = (await readFile(`./android/app/src/main/res/values/strings.xml`)).split('\n');
  stringXml.forEach(v => {
    if (!applied1 && v.indexOf('name="CodePushDeploymentKey"') >= 0) {
      applied1 = true;
    }
  });

  if (!applied1) {
    console.log('[and] Edit to strings.xml ');

    const index1 = stringXml.findIndex(v => v.indexOf('name="app_name"') >= 0);
    stringXml.splice(index1 + 1, 0, `    <string moduleConfig="true" name="CodePushDeploymentKey">${codepushKey}</string>`);

    await writeFile(`./android/app/src/main/res/values/strings.xml`, stringXml.join("\n"));
  }


  let applied2 = false;
  const buildGradle = (await readFile(`./android/app/build.gradle`)).split('\n');
  buildGradle.forEach(v => {
    if (!applied2 && v.indexOf('react-native-code-push/android/codepush.gradle') >= 0) {
      applied2 = true;
    }
  });

  if (!applied2) {
    console.log('[and] Edit to build.gradle ');

    const index1 = buildGradle.findIndex(v => v.startsWith('apply from: "../../node_modules/react-native/react.gradle"'));
    buildGradle.splice(index1 + 1, 0, `apply from: "../../node_modules/react-native-code-push/android/codepush.gradle"`);

    await writeFile(`./android/app/build.gradle`, buildGradle.join("\n"));
  }

  let pkgname = buildGradle.find(v => v.indexOf('applicationId') >= 0);
  pkgname = pkgname.substring(pkgname.indexOf('"') + 1);
  pkgname = pkgname.substring(0, pkgname.indexOf('"'));
  pkgname = pkgname.replace(/\./g, '/');

  let applied3 = false;
  const mainApplicationJava = (await readFile(`./android/app/src/main/java/${pkgname}/MainApplication.java`)).split('\n');
  mainApplicationJava.forEach(v => {
    if (!applied3 && v.indexOf('CodePush.getJSBundleFile();') >= 0) {
      applied3 = true;
    }
  });

  if (!applied3) {
    console.log('[and] Edit to MainApplication.java ');

    const index1 = mainApplicationJava.findIndex(v => v.indexOf('new ReactNativeHost(this)') >= 0);
    mainApplicationJava.splice(index1 + 1, 0, ` @Override`);
    mainApplicationJava.splice(index1 + 2, 0, ` protected String getJSBundleFile() {`);
    mainApplicationJava.splice(index1 + 3, 0, `   return CodePush.getJSBundleFile();`);
    mainApplicationJava.splice(index1 + 4, 0, ` }`);

    const index2 = mainApplicationJava.findIndex(v => v.indexOf('public class MainApplication') >= 0);
    mainApplicationJava.splice(index2, 0, `import com.microsoft.codepush.react.CodePush;`);
    mainApplicationJava.splice(index2 + 1, 0, ``);

    await writeFile(`./android/app/src/main/java/${pkgname}/MainApplication.java`, mainApplicationJava.join("\n"));
  }

  console.log('[and] Finished..! ');
  return true;
}



const App = async (pkgs, forceReset) => {

  console.log("Intialized to Codepush");

  const file = JSON.parse(await readFile('./package.json'));

  if (Object.keys(file.dependencies).indexOf('react-native-code-push') < 0) {
    console.log('install to codepush...');
    await execute('npm i react-native-code-push');
  }

  const result1 = await runIos(file);
  const result2 = await runAndroid(file);

  if (result1) {
    file.scripts['codepush-ios'] = 'rm -rf build_ios && appcenter codepush release-react -a $npm_package_appcenter_ios -d Production --output-dir build_ios';
  }
  if (result2) {
    file.scripts['codepush-and'] = 'rm -rf build_and && appcenter codepush release-react -a $npm_package_appcenter_and -d Production --output-dir build_and';
  }

  if (result1 || result2) {
    console.log(" save to package.json");
    const text = JSON.stringify(file, null, 2);
    await writeFile("./package.json", text);
  }

};

program
  .parse(process.argv);

var pkgs = program.args;
App(pkgs, (process.argv.indexOf('-r') > 0 || process.argv.indexOf('--reset') >= 0));


