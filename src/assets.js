import { writeFile, readText, getPackageJson, execute } from './utils';

const fs = require('fs');
const program = require('commander');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

const scanFiles = dir => {
  return new Promise(async resolve => {
    let result = {};
    fs.readdir(dir, async (err, items) => {
      let files = items.filter(v => v.indexOf('.') !== 0);

      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        let stat = fs.lstatSync(dir + '/' + item);
        if (stat.isDirectory()) {
          result[item] = await scanFiles(dir + '/' + item);
        } else {
          let name = item.substring(0, item.lastIndexOf('.'));
          name = name.replace(/\./g, '_');
          result[name] = '@' + dir + '/' + item;
        }
      }
      resolve(result);
    });
  });
};

const App = async (pkgs, forceReset) => {
  let _config = {};
  const file = await getPackageJson();

  if (file?.actbase?.assets) _config = file?.actbase?.assets;
  if (forceReset) _config = {};

  if (!_config?.source) {
    const source = await readText('해당 폴더경로를 입력해주세요 : ./');
    if (!source) {
      console.error('출력 항목은 필수입니다.');
      process.exit(1);
    }

    if (!fs.existsSync(source)) {
      console.error('파일을 찾을수가 없어요.');
      process.exit(1);
    }

    _config.source = source;

    file.actbase.assets = _config;
    const text = JSON.stringify(file, null, 2);
    await writeFile('./package.json', text);
  }

  if (!_config?.output) {
    const output = await readText(
      'required 묶음이 나올 파일경로(확장자 포함)를 입력해주세요 : ./',
    );
    if (!output) {
      console.error('경로 항목은 필수입니다.');
      process.exit(1);
    }

    if (fs.existsSync(output)) {
      console.error('이미 파일이 존재합니다.');
      process.exit(1);
    }
    _config.output = output;

    file.actbase.assets = _config;
    const text = JSON.stringify(file, null, 2);
    await writeFile('./package.json', text);
  }

  const files = await scanFiles(_config?.source);

  let response = JSON.stringify(files, null, 2);
  response =
    'export default ' +
    response.replace(/\"@([^\"]*)"/g, "require('$1')").replace(/"/g, "'");

  await writeFile(_config?.output, response);

  console.log('Write a file! ');
  console.log('Usage: ');
  console.log(`  import Assets from "${_config?.output}"`);
  console.log('  <Image source={Assets.imagename} />');

  await execute("git add " + _config.output);

};

program.option('-r, --reset', 'reset latest file.').parse(process.argv);

var pkgs = program.args;
App(
  pkgs,
  process.argv.indexOf('-r') > 0 || process.argv.indexOf('--reset') >= 0,
);
