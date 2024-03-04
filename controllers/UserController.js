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
                    resolve(uuidv4());
                }).catch((error) => {
                    reject("Server save error, please try again.");
                });
            }).catch(() => {reject("Server hash error, please try again.")});
        }).catch(() => {reject("Server salt error, please try again.")});
    });
}

exports.createUser = createUser;