const fs = require('fs');
const program = require('commander');

if (!fs.existsSync('./package.json')) {
  console.error('Not found package.json');
  process.exit(1);
}

console.log('hasfile',);

// program
//   .option('-f, --force', 'force installation')
//   .parse(process.argv);
//
//
// var pkgs = program.args;
//
// if (!pkgs.length) {

// }
