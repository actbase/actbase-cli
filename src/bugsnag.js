import { writeFile, readText, getPackageJson, select, execute } from './utils';

const fs = require('fs');
const program = require('commander');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

const App = async (pkgs, forceReset) => {
  let pkgv = null;
  const file = await getPackageJson(pk => {
    pkgv = pk.version;
  });

  if (!file.bugsnag) return;

  file.version++;
  const text = JSON.stringify(file, null, 2);
  await writeFile('./actbase.json', text);

  if (file.bugsnag) {
    try {
      await execute(`rm -rf build_ios && mkdir build_ios`);

      const cmd1 = `
        npx react-native bundle 
          --platform ios 
          --dev false 
          --entry-file index.js 
          --bundle-output build_ios/release.bundle 
          --sourcemap-output build_ios/release.bundle.map
      `;
      await execute(cmd1);

      const cmd2 = `npx bugsnag-sourcemaps upload --api-key ${file.bugsnag}
         --source-map build_ios/release.bundle.map
         --minified-file build_ios/release.bundle
         --minified-url main.jsbundle
         --upload-sources
         --add-wildcard-prefix
         --code-bundle-id ${pkgv}-${file.version}`;
      await execute(cmd2);
    } catch (e) {
      console.log(e);
    }
    await execute(`rm -rf build_ios`);

    try {
      await execute(`rm -rf build_and && mkdir build_and`);
      const cmd1 = `
        npx react-native bundle 
          --platform android 
          --dev false 
          --entry-file index.js 
          --bundle-output build_and/release.bundle 
          --sourcemap-output build_and/release.bundle.map
      `;
      await execute(cmd1);

      const cmd2 = `npx bugsnag-sourcemaps upload --api-key ${file.bugsnag}
         --source-map build_and/release.bundle.map
         --minified-file build_and/release.bundle
         --minified-url index.android.bundle
         --upload-sources
         --add-wildcard-prefix
         --code-bundle-id ${pkgv}-${file.version}`;
      await execute(cmd2);
    } catch (e) {
      console.log(e);
    }
    await execute(`rm -rf build_and`);
  }
};

program.option('-r, --reset', 'reset latest file.').parse(process.argv);

var pkgs = program.args;
App(
  pkgs,
  process.argv.indexOf('-r') > 0 || process.argv.indexOf('--reset') >= 0,
);
