import { writeFile, readText, getPackageJson, select } from './utils';

const fs = require('fs');
const fetch = require('node-fetch');
const program = require('commander');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

const parseCSV = csv => {
  const rows = csv.replace(/\r/g, '').split('\n');
  const column = rows.splice(0, 1)[0]?.split(',');

  let files = {};
  for (let i = 1; i < column.length; i++) {
    files[column[i]] = {};
  }

  rows.forEach(row => {
    const data = row.split(',');
    for (let i = 1; i < column.length; i++) {
      files[column[i]][data[0]] = data[i] || '$$' + data[0];
    }
  });

  return files;
};

const parseGJson = json => {
  let rows = [];
  let column = [];
  json?.feed?.entry?.forEach(v => {
    const cell = v['gs$cell'];
    if (parseInt(cell.row) === 1) {
      column[parseInt(cell.col) - 1] = cell.inputValue;
    } else {
      if (!rows[parseInt(cell.row) - 2]) rows[parseInt(cell.row) - 2] = [];
      rows[parseInt(cell.row) - 2][parseInt(cell.col) - 1] = cell.inputValue;
    }
  });

  let files = {};
  for (let i = 1; i < column.length; i++) {
    files[column[i]] = {};
  }

  rows.forEach(data => {
    for (let i = 1; i < column.length; i++) {
      files[column[i]][data[0]] = data[i] || '$$' + data[0];
    }
  });

  return files;
};

const App = async (pkgs, forceReset) => {
  let _config = {};
  const file = await getPackageJson();

  if (file?.actbase?.i18n) _config = file?.actbase?.i18n;
  if (forceReset) _config = {};

  if (!_config?.output) {
    const output = await readText(
      'Enter the folder where create the language json : ',
    );
    if (!output) {
      console.log('Folder is required');
      process.exit(1);
    }
    _config.output = output;
  }

  if (_config?.preset === undefined) {
    const value = await select('What kind of file do you want?', [
      'Google Docs',
      'Spreadsheet File (xlsx)',
    ]);
    _config.preset = value?.id;
  }

  if (!_config?.path) {
    const path = await readText('Path : ');
    if (!path) {
      console.log('Path is required');
      process.exit(1);
    }
    _config.path = path;
  }

  if (_config.preset === 1) {
    // File Parse..

    if (!fs.existsSync(_config.path)) {
      console.log(' ');
      console.error('파일을 찾을수가 없어요.');
      process.exit(1);
    }
  } else if (_config.preset === 0) {
    // Google Docs..
    if (_config.path.indexOf('https://docs.google.com/spreadsheets/d/') !== 0) {
      console.log(' ');
      console.error('구글 경로가 아닌가봅니다.');
      process.exit(1);
    }

    if (_config.path.indexOf('pub?output=csv') >= 0) {
      const response = await fetch(_config.path);
      const data = await response.text();

      const files = parseCSV(data);
      const fnames = Object.keys(files);

      if (!fs.existsSync(`${_config.output}`)) {
        fs.mkdirSync(`${_config.output}`);
      }

      for (let i = 0; i < fnames?.length; i++) {
        const text = JSON.stringify(files[fnames[i]], null, '  ');
        const savePath = `${_config.output}/${fnames[i]}.json`.replace(
          /\/\//g,
          '/',
        );

        await writeFile(savePath, text);
        console.log(` ==> ${savePath} 저장 완료!`);
      }
    } else if (_config.path.indexOf('/edit#gid=') >= 0) {
      let key = _config.path.substring(39);
      key = key.substring(0, key.indexOf('/'));

      const uri = `https://spreadsheets.google.com/feeds/cells/${key}/1/public/full?alt=json`;
      const response = await fetch(uri);
      let data = await response.text();

      let json = null;
      try {
        json = JSON.parse(data);
      } catch (e) {
        console.error(
          'Publish 모드가 아닌 것 같습니다. 확인후 다시 시도해주세요.\n참고 URL: https://www.freecodecamp.org/news/cjn-google-sheets-as-json-endpoint/',
        );
        process.exit(1);
      }

      const files = parseGJson(json);
      const fnames = Object.keys(files);

      if (!fs.existsSync(`${_config.output}`)) {
        fs.mkdirSync(`${_config.output}`);
      }

      for (let i = 0; i < fnames?.length; i++) {
        const text = JSON.stringify(files[fnames[i]], null, '  ');
        const savePath = `${_config.output}/${fnames[i]}.json`.replace(
          /\/\//g,
          '/',
        );

        await writeFile(savePath, text);
        console.log(savePath + ' 저장 완료!');
      }
    } else {
      console.error('구글 경로가 아닌가봅니다.');
      process.exit(1);
    }

    file.actbase.i18n = _config;
    const text = JSON.stringify(file, null, 2);
    await writeFile('./package.json', text);
  }
};

program.option('-r, --reset', 'reset latest file.').parse(process.argv);

var pkgs = program.args;
App(
  pkgs,
  process.argv.indexOf('-r') > 0 || process.argv.indexOf('--reset') >= 0,
);
