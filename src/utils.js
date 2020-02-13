const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');
const cliSelect = require('cli-select');
const chalk = require('chalk');

export const execute = cmd => {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
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

export const readText = question => {
  return new Promise((resolve, reject) => {
    const r = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    r.question(question, data => {
      r.close();
      resolve(data);
    });
  });
};

export const getPackageJson = async () => {
  const file = JSON.parse(await readFile('./package.json'));
  if (!file?.actbase) {
    const keys = Object.keys(file?.dependencies);
    let preset = 'react';
    if (keys?.indexOf('react-native') >= 0) {
      preset = 'react-native';
    } else if (keys?.indexOf('gatsbyjs') >= 0) {
      preset = 'gatsbyjs';
    } else if (keys?.indexOf('nextjs') >= 0) {
      preset = 'nextjs';
    }
    file.actbase = { preset };
  }

  return file;
};

export const select = async (message, values) => {
  console.log(message);
  const result = await cliSelect({
    cleanup: false,
    values,
    valueRenderer: (value, selected) => {
      if (selected) {
        return chalk.underline(value);
      }
      return value;
    },
  });
  console.log(' ==> ' + result.value + '\n');
  return result;
};

export default {
  readFile,
  writeFile,
  readText,
  execute,
};
