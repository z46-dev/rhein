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
    "+": (a, b) => `${a} + ${b}`, //[a, b].join(" + "),
    "-": (a, b) => `${a} - ${b}`, //[a, b].join(" - "),
    "*": (a, b) => `${a} * ${b}`, //[a, b].join(" * "),
    "/": (a, b) => `${a} / ${b}` //[a, b].join(" / ")
};

class Variable {
    constructor(name, type, value) {
        this.name = `${type}_${name}`;
        this.type = type;
        this.value = value;
    }
}

// Get stuff that's in the string until the search
function getUntilNext(code, search) {
    // Turn the code to a string
    code = code.join(" ");

    // Find the code
    let index = code.indexOf(search);

    // If we cannot find our query...
    if (index === -1) {
        // Then return a -1 to signify as such
        return -1;
    }

    // Get the code that's in the query
    let result = code.slice(0, index);

    // Return the new code, and the code we took out
    return [code.replace(result + search, "").split(" "), result];
}

// Get the actual value of something, possible simlpifying later?
function getValue(value, variables, typeName) {
    // Get the type Object
    let type = types[typeName];

    // Split the value
    value = value.split(" ");

    // Start with the real value
    let realValue = value[0];

    // If there are variables with this name, use their value
    if (variables[realValue] !== undefined) {

        // TypeStrict stuff
        if (variables[realValue].type !== typeName) {
            throw new Error(`Cannot operate a(n) ${variables[realValue].type} (${realValue}) to a(n) ${typeName}!`);
        }

        // Apply value
        realValue = variables[realValue].name;
    } else {
        // Convert to number if needed
        if (type.jsType === "number") {
            realValue = Number(realValue);
        }

        // Check the value and stuff
        if (type.check(realValue) === false) {
            throw new Error(`Value ${realValue} is not of type ${typeName}!`);
        }
    }

    // Do it for the rest
    for (let i = 1; i < value.length; i++) {
        // Check if it's an operator (it should always be)
        if (operators[value[i]]) {
            // If it's a variable, use the value of that variable
            if (variables[value[i + 1]] !== undefined) {
                // TypeStrict stuff
                if (variables[value[i + 1]].type !== typeName) {
                    throw new Error(`Cannot operate a(n) ${variables[value[i + 1]].type} (${value[i + 1]}) to a(n) ${typeName}!`);
                }

                // Apply Value
                value[i + 1] = variables[value[i + 1]].name;
            } else {
                // Convert for numbers
                if (type.jsType === "number") {
                    value[i + 1] = Number(value[i + 1]);
                }

                // TypeStrict check
                if (type.check(value[i + 1]) === false) {
                    throw new Error(`Value ${value[i + 1]} is not of type ${typeName}!`);
                }
            }

            // Apply value
            realValue = operators[value[i]](realValue, value[i + 1]);

            // Skip over the value we just read.
            i++;
        } else {
            // Throw the error if it's not an operator.
            throw new Error(`Unexpected value [${value[i]}]!`);
        }
    }
    return realValue;
}

// The main compiling function, can be called in itself to compile labels
function compile(code, variables = {}, indents = 0, inLabel = false, isTypeStrict = true) {
    // Trim the code up
    code = code.split("\n").join(" ").trim();

    // The typeStrict check
    if (code.startsWith("@typeStrict=")) {
        // Get itttt bestie
        let stopIndex = code.indexOf(";");

        // If it's invalid as a configuration statement, invade Antarctica
        if (stopIndex === -1) {
            throw new Error("Invalid typeStrict statement!");
        }

        // Get the raw value
        isTypeStrict = code.slice(12, stopIndex);

        // Convert it to a boolean
        if (isTypeStrict == "false" || isTypeStrict === "no") {
            isTypeStrict = false;
        } else if (isTypeStrict == "true" || isTypeStrict === "yes") {
            isTypeStrict = true;
        }

        // Replace this sequence in the code
        code = code.slice(stopIndex + 1);
    }

    // Trim up and split apart the code to look nice
    code = code.trim().split("\n").map(r => r.trim()).filter(r => r.length).join(" ").split(" ");

    // Create the basic output
    let compiledJS = " ".repeat(indents) + "// Rhein@2.0 Compiled code, isTypeStrict: " + isTypeStrict + "!\n";

    // Compile everything
    while (code.length) {
        // Get our current code
        let chunk = code.shift();

        // Idk why I have to do this, but I do
        if (chunk.length < 1) {
            continue;
        }

        // Hopefully, it's a command
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
            }
            break;
            case "return": { // Return command
                // If we aren't in a label, throw an error.
                if (!inLabel) {
                    throw new Error("Cannot return anything outside of a label!");
                }

                // Cuz Rhein is both typestrict and not typestrict, we need to get the proper type based on the context.
                let type = isTypeStrict ? code.shift() : "any";

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
            }
            break;
            default: {
                if (types[chunk] !== undefined || !isTypeStrict) {
                    // Set up the proper type
                    let type = isTypeStrict ? types[chunk] : types.any,
                        typeName = isTypeStrict ? chunk : "any";

                    // If we aren't in TypeStrict mode, let's get rid of the type requirement
                    if (isTypeStrict === false) {
                        if (chunk.length > 0) {
                            code.unshift(chunk);
                        }
                    }

                    // Get the variable name
                    let name = code.shift();

                    // If the next thing isn't an "=", then we got an issue.
                    if (code.shift() !== "=") {
                        throw new Error("Invalid variable declaration!");
                    }

                    // Get the value of the variable
                    let valueFound = getUntilNext(code, ";");

                    // If it doesn't exist, throw an error.
                    if (valueFound === -1) {
                        throw new Error(`Cannot find value of variable ${name}!`);
                    }

                    // Extract the new code without the value, and the value.
                    let [newCode, value] = valueFound;

                    // Replace the new code with the old code, minus the value.
                    code = newCode;

                    // Get the value of the value.
                    let realValue = getValue(value, variables, typeName);

                    // Add stuff to the compiled code.
                    compiledJS += `${" ".repeat(indents)}/**\n${" ".repeat(indents + 1)}* @name ${name}\n${" ".repeat(indents + 1)}* @type ${type.jsType}\n${" ".repeat(indents + 1)}*/\n${" ".repeat(indents)}let ${typeName}_${name} = ${realValue};\n`;

                    // Add the new variable to the cache.
                    variables[name] = new Variable(name, typeName, realValue);
                }
            }
            break;
        }
    }
    return compiledJS.slice(0, -1).trimEnd();
}

module.exports = compile;