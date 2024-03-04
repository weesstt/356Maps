const mongoose = require("mongoose");

var Schema = mongoose.Schema

var UserSchema = new Schema({
    username: {type: String, required: true},
    email: {type: String, required: true},
    password: {type: String, required: true},
    verifyKey: {type: String, required: true},
    verified: {type: Boolean, default: false},
})

module.exports = mongoose.model("User", UserSchema)