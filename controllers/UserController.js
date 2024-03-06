const { Schema } = require("mongoose");
const UserModel = require("../models/users.js");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');

//Returns a promise that resolves to the verify key if successful, otherwise error
async function createUser(username, email, password){
    let emailResults = await UserModel.find({email: email});
    let usernameResults = await UserModel.find({username: username});
    return new Promise((resolve, reject) => {
        
        if(emailResults.length !== 0){
            reject("A user with that email already exists");
            return;
        }

        if(usernameResults.length !== 0){
            reject("A user with that username already exists");
            return;
        }

        const saltRounds = 10;
        bcrypt.genSalt(saltRounds).then((salt) => {
            bcrypt.hash(password, salt).then((passwordHash) => {
                var user = new UserModel({
                    username: username,
                    email: email,
                    password: passwordHash,
                    verifyKey: uuidv4()
                });

                user.save().then((result) => {
                    resolve(user.verifyKey);
                }).catch((error) => {
                    reject("Server save error, please try again.");
                });
            }).catch(() => {reject("Server hash error, please try again.")});
        }).catch(() => {reject("Server salt error, please try again.")});
    });
}

async function verifyUser(email, providedKey){
    let emailResults = await UserModel.find({email: email});
    return new Promise((resolve, reject) => {
        if(emailResults.length === 0){
            reject("No user with that email exists, please register.");
            return;
        }

        const user = emailResults[0];
        const verified = user.verified;
        const key = user.verifyKey;
        
        if(verified){
            reject("This account has already been verified, please sign in");
            return;
        }

        if(providedKey !== key){
            reject("Invalid key to verify account, please try again.");
            return;
        }

        UserModel.findByIdAndUpdate(user.id, {verified: true}).then(() => {
            resolve("Account verified, please sign in.");
        }).catch(() => {
            reject("Database error, please try again.");
        })
    });
}

async function checkLogin(username, password) {
    try {
        const user = await UserModel.findOne({username: username});
        if (!user) {
            throw new Error("Invalid credentials");
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            throw new Error("Invalid credentials")
        }

        return("Logged in successfully")
    } catch (error) {
        throw error;
    }
}

exports.createUser = createUser;
exports.verifyUser = verifyUser;
exports.checkLogin = checkLogin;