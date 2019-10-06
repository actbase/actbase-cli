const fs = require('fs');
const fetch = require('node-fetch');
const program = require('commander');
const readline = require('readline');
const cliSelect = require('cli-select');
const chalk = require('chalk');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

const readFile = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(data);
      }
    })
  });
};

const writeFile = (path, content) => {
	return new Promise((resolve, reject) => {
		fs.writeFile(path, content, 'utf8', (err, data) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(data);
			}
		})
	});
};

const readText = (question) => {
  return new Promise((resolve, reject) => {
    const r = readline.createInterface({ input: process.stdin, output: process.stdout });
    r.question(question, (data) => {
      resolve(data);
			r.close();
    });
  });
};

const parseCSV = (csv) => {
	const rows = csv.replace(/\r/g, '').split("\n");
	const column = rows.splice(0, 1)[0]?.split(",");

	let files = {};
	for (let i = 1; i < column.length; i++) {
		files[column[i]] = {};
	}

	rows.forEach(row => {
		const data = row.split(",");
		for (let i = 1; i < column.length; i++) {
			files[column[i]][data[0]] = data[i] || "$$" + data[0];
		}
	});

	return files;
};


const App = async (pkgs, forceReset) => {

  let _config = {};

  const file = JSON.parse(await readFile('./package.json'));
  if (!file?.actbase) {
    const keys = Object.keys(file?.dependencies);
    let preset = 'react';
    if (keys?.indexOf('react-native') >= 0) {
      preset = 'react-native';
    }
    else if (keys?.indexOf('gatsbyjs') >= 0) {
      preset = 'gatsbyjs';
    }
    else if (keys?.indexOf('nextjs') >= 0) {
      preset = 'nextjs';
    }
    file.actbase = { preset };
  }

  if (file?.actbase?.i18n) _config = file?.actbase?.i18n;
	if (forceReset) _config = {};


  if (_config?.preset === undefined) {
    console.log('언어팩 생성준비를 시작합니다.')
    const value = await cliSelect({
      values: ['Google Docs', 'Spreadsheet File (xlsx)'],
      valueRenderer: (value, selected) => {
        if (selected) {
          return chalk.underline(value);
        }
        return value;
      },
    });
    _config.preset = value?.id;
    console.log(value?.value + ' Selected!');
  }

	if (!_config?.output) {
		const output = await readText('언어팩 생성할 경로를 입력하세요 : ');
		if (!output) {
			console.error('출력 항목은 필수입니다.');
			process.exit(1);
		}
		_config.output = output;
	}

  if (!_config?.path) {
    const path = await readText('해당 소스파일(XLS or CSV)을 입력하세요 : ');
    if (!path) {
			console.error('경로 항목은 필수입니다.');
			process.exit(1);
		}
		_config.path = path;
  }

  if (_config.preset === 1) {
  	// File Parse..

		if (!fs.existsSync(_config.path)) {
			console.error('파일을 찾을수가 없어요.');
			process.exit(1);
		}
	}
  else if (_config.preset === 0) {
  	// Google Docs..
		if (_config.path.indexOf('https://docs.google.com/spreadsheets/d/') !== 0) {
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

				const text = JSON.stringify(files[fnames[i]], null, 2);
				const savePath = `${_config.output}/${fnames[i]}.json`.replace(/\/\//g, "/");

				await writeFile(savePath, text);
				console.log(savePath + " 저장 완료!");
			}
		}


		file.actbase.i18n = _config;
		const text = JSON.stringify(file, null, 2);
		await writeFile("./package.json", text);

	}


};

program
  .option('-r, --reset', 'reset latest file.')
  .parse(process.argv);


var pkgs = program.args;
App(pkgs, (process.argv.indexOf('-r') > 0 || process.argv.indexOf('--reset') >= 0) );

//

