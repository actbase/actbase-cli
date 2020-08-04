const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');
const inquirer = require('inquirer');

export const execute = cmd => {
  return new Promise((resolve, reject) => {
    exec(cmd?.replace(/\n/g, ' '), (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

export const readFile = path => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

export const writeFile = (path, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

export const readText = async message => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message,
    },
  ]);
  return answers.input;
};

export const getPackageJson = async fn => {
  const pfile = JSON.parse(await readFile('./package.json'));
  await fn?.(pfile);

  let cfile = {};
  if (!fs.existsSync('./actbase.json')) {
    const keys = Object.keys(pfile?.dependencies);
    let preset = 'react';
    if (keys?.indexOf('react-native') >= 0) {
      preset = 'react-native';
    } else if (keys?.indexOf('gatsbyjs') >= 0) {
      preset = 'gatsbyjs';
    } else if (keys?.indexOf('nextjs') >= 0) {
      preset = 'nextjs';
    }
    const text = JSON.stringify({ preset }, null, 2);
    await writeFile('./actbase.json', text);

    cfile.preset = preset;
  } else {
    cfile = JSON.parse(await readFile('./actbase.json'));
  }
  return cfile;
};

export const select = async (message, choices) => {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'input',
        message,
        choices,
      },
    ]);

    const result = {
      value: answers.input,
      id: choices.indexOf(answers.input),
    };
    return result;
  } catch (e) {
    process.exit(1);
  }
};

export default {
  readFile,
  writeFile,
  readText,
  execute,
};
