const types = {
    "int": {
        "jsType": "number",
        "check": value => value === (Number(value) | 0),
        "default": 0
    },
    "float": {
        "jsType": "number",
        "check": value => value === Number(value),
        "default": 0
    },
    "str": {
        "jsType": "string",
        "check": value => value === value + "",
        "default": ""
    },
    "any": {
        "jsType": "Symbol",
        "check": value => true,
        "default": ""
    }
};

const returnType = "any";

let operators = {
    "+": (a, b) => [a, b].join(" + "),
    "-": (a, b) => [a, b].join(" - "),
    "*": (a, b) => [a, b].join(" * "),
    "/": (a, b) => [a, b].join(" / ")
};

class Variable {
    constructor(name, type, value) {
        this.name = `${type}_${name}`;
        this.type = type;
        this.value = value;
    }
}

function getUntilNext(code, search) {
    code = code.join(" ");
    let index = code.indexOf(search);
    if (index === -1) {
        return -1;
    }
    let result = code.slice(0, index);
    return [code.replace(result + search, "").split(" "), result];
}


function getValue(value, variables, typeName) {
    let type = types[typeName];
    value = value.split(" ");
    let realValue = value[0];
    if (variables[realValue] !== undefined) {
        if (variables[realValue].type !== typeName) {
            throw new Error(`Cannot operate a(n) ${variables[realValue].type} (${realValue}) to a(n) ${typeName}!`);
        }
        realValue = variables[realValue].name;
    } else {
        if (type.jsType === "number") {
            realValue = Number(realValue);
        }
        if (type.check(realValue) === false) {
            throw new Error(`Value ${realValue} is not of type ${typeName}!`);
        }
    }
    for (let i = 1; i < value.length; i++) {
        if (operators[value[i]]) {
            if (variables[value[i + 1]] !== undefined) {
                if (variables[value[i + 1]].type !== typeName) {
                    throw new Error(`Cannot operate a(n) ${variables[value[i + 1]].type} (${value[i + 1]}) to a(n) ${typeName}!`);
                }
                value[i + 1] = variables[value[i + 1]].name;
            } else {
                if (type.jsType === "number") {
                    value[i + 1] = Number(value[i + 1]);
                }
                if (type.check(value[i + 1]) === false) {
                    throw new Error(`Value ${value[i + 1]} is not of type ${typeName}!`);
                }
            }
            realValue = operators[value[i]](realValue, value[i + 1]);
            i++;
        } else {
            throw new Error(`Unexpected value [${value[i]}]!`);
        }
    }
    return realValue;
}

function compile(code, variables = {}, indents = 0, inLabel = false, isTypeStrict = true) {
    code = code.split("\n").join(" ").trim();
    if (code.startsWith("@typeStrict=")) {
        let stopIndex = code.indexOf(";");
        if (stopIndex === -1) {
            throw new Error("Invalid typeStrict statement!");
        }
        isTypeStrict = code.slice(12, stopIndex);
        if (isTypeStrict == "false" || isTypeStrict === "no") {
            isTypeStrict = false;
        } else if (isTypeStrict == "true" || isTypeStrict === "yes") {
            isTypeStrict = true;
        }
        code = code.slice(stopIndex + 1);
    }
    code = code.trim().split("\n").map(r => r.trim()).filter(r => r.length).join(" ").split(" ");
    let compiledJS = " ".repeat(indents) + "// Rhein@2.0 Compiled code, isTypeStrict: " + isTypeStrict + "!\n";
    while (code.length) {
        let chunk = code.shift();
        if (chunk.length < 1) {
            continue;
        }
        switch (chunk) {
            case "gpio": // GPIO command
                break;
            case "arduino": // Arduino command
                break;
            case "label": { // Label command
                let labelName = code.shift();

                // Check if it's a proper label declaration.
                if (!labelName?.endsWith(":")) {
                    throw new Error("Invalid label initialization!");
                }

                // Remove the colon from the label name.
                labelName = labelName.slice(0, -1);

                // Get the contents of the label.
                let labelContents = getUntilNext(code, `label ${labelName};`);

                // If there's no label contents, throw an error.
                if (labelContents === -1) {
                    throw new Error(`The contents of the label ${labelName} are invalid. This could be because the label is not closed, or the label is fucked up.`);
                }

                // Extract the new code without the label, and the code in the label.
                let [newCode, insideLabel] = labelContents;

                // Replace the new code with the old code, minus the label.
                code = newCode;

                // Compile the code inside the label.
                compiledJS += `function ${labelName}() {\n${compile(insideLabel, variables, indents, labelName, isTypeStrict)}\n}\n`;

                // Clean up the remaining code.
                code = code.join(" ").replace(`label ${labelName}:`).replace(`label ${labelName};`).split(" ");
            } break;
            case "return": { // Return command
                // If we aren't in a label, throw an error.
                if (!inLabel) {
                    throw new Error("Cannot return anything outside of a label!");
                }

                // Cuz Rhein is both typestrict and not typestrict, we need to get the proper type based on the context.
                let type = isTypeStrict ? code.shift() : code[0];

                // If the type is not valid, throw an error.
                if (types[type] === undefined) {
                    throw new Error(`Invalid return type ${type}!`);
                }

                // Get the value of the return.
                let returnValue = getUntilNext(code, ";");

                // If the return value is invalid, throw an error.
                if (returnValue === -1) {
                    throw new Error("Invalid return value!");
                }

                // Extract the new code without the return, and the return value.
                let [newCode, value] = returnValue;

                // Replace the new code with the old code, minus the return.
                code = newCode;

                // Get the value of the return.
                let realValue = getValue(value, variables, type);

                // Add the return statement to the compiled JS.
                compiledJS += `${" ".repeat(indents)}/**\n${" ".repeat(indents + 1)}* @name ${inLabel} return value\n${" ".repeat(indents + 1)}* @type ${types[type].jsType}\n${" ".repeat(indents + 1)}*/\n${" ".repeat(indents)}return ${realValue};\n`;
            } break;
        }
        if (chunk === "robot") {} else if (chunk === "label") {
            let labelName = code.shift();
            if (!labelName.endsWith(":")) {
                throw new Error("Invalid label statement!");
            }
            labelName = labelName.slice(0, -1);
            let getResult = getUntilNext(code, `label ${labelName};`);
            if (getResult === -1) {
                throw new Error(`Cannot find closing label for ${labelName}`);
            }
            let [newCode, inLabel] = getResult;
            code = newCode;
            compiledJS += `function ${labelName}() {\n${compile(inLabel, variables, indents + 4, labelName, isTypeStrict)}\n}\n`;
            code = code.join(" ").replace(`label ${labelName}:`).replace(`label ${labelName};`).split(" ");
        } else if (chunk === "return") {
            if (!inLabel) {
                throw new Error("Invalid return statement");
            }
            let type = isTypeStrict ? code.shift() : "any";
            if (types[type] === undefined) {
                throw new Error(`Invalid return type [${type}]!`);
            }
            let [newCode, value] = getUntilNext(code, ";");
            code = newCode;
            let realValue = getValue(value, variables, type);
            compiledJS += `${" ".repeat(indents)}/**\n${" ".repeat(indents + 1)}* @name ${inLabel} return value\n${" ".repeat(indents + 1)}* @type ${types[type].jsType}\n${" ".repeat(indents + 1)}*/\n${" ".repeat(indents)}return ${realValue};\n`;
        } else if (types[chunk] !== undefined || !isTypeStrict) {
            let type = isTypeStrict ? types[chunk] : types.any,
                typeName = isTypeStrict ? chunk : "any";
            if (!isTypeStrict) {
                if (chunk.length) {
                    code.unshift(chunk);
                }
            }
            let name = code.shift();
            if (code.shift() !== "=") {
                throw new Error("Invalid declaration!");
            }
            let [newCode, value] = getUntilNext(code, ";");
            code = newCode;
            let realValue = getValue(value, variables, typeName);
            compiledJS += `${" ".repeat(indents)}/**\n${" ".repeat(indents + 1)}* @name ${name}\n${" ".repeat(indents + 1)}* @type ${type.jsType}\n${" ".repeat(indents + 1)}*/\n${" ".repeat(indents)}let ${typeName}_${name} = ${realValue};\n`;
            variables[name] = new Variable(name, typeName, realValue);
        }
    }
    return compiledJS.slice(0, -1).trimEnd();
}

module.exports = compile;
