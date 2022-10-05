const compile = require("./compiler.js");

/*console.log(compile(`
@typeStrict=true;
int hello = 102 + 5;
int goodbye = hello + 5;
int sexy = goodbye / 2 + hello;
label ok:
    int noob = 10 + sexy;
    return int 210983 + noob + 1;
label ok;
`));*/

console.log(compile(`
@typeStrict=false;
hello = 102 + 5;
goodbye = hello + 5;
sexy = goodbye / 2 + hello;
label ok:
    noob = 10 + sexy;
    return 210983 + noob + 1;
label ok;
`));