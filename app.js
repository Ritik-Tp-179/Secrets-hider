//jshint esversion:6
require("dotenv").config()
const express = require("express")
const app = express()
const bodyparser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const md5 = require("md5")
const session = require("express-session")
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const findOrCreate = require("mongoose-findorcreate")
const GoogleStrategy = require('passport-google-oauth20').Strategy;
app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
}));
 
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://127.0.0.1:27017/userDB", { useNewUrlParser: true })
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)
const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy());
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username, name: user.name });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileUrl: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.use(express.static("public"))
app.use(bodyparser.urlencoded({ extended: true }))
app.set("view engine", "ejs")

app.get("/", (req, res) => {
    res.render("home")
})

app.get('/auth/google',
    passport.authenticate("google", { scope: ['profile'] }));

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    });

app.get("/login", (req, res) => {
    res.render("login")
})

app.get("/register", (req, res) => {
    res.render("register")
})
app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
    User.find({ "secret": { $ne: null } }).then(founduser => {
        if (founduser) {
            res.render("secrets", { userSecrets: founduser })
        }
    })
        .catch(err => {
            console.log(err);
        })
    } else {
        res.redirect("/login");
    }
})
// app.get("/secrets", (req, res) => {
//     User.find({ "secret": { $ne: null } }).then(founduser => {
//         if (founduser) {
//             res.render("secrets", { userSecrets: founduser })
//         }
//     })
//         .catch(err => {
//             console.log(err);
//         })
// })

app.post("/register", (req, res) => {
    User.register({ username: req.body.username }, req.body.password).then(user => {
        passport.authenticate("local")(req, res, function () {
            res.redirect("/secrets")
        })
    }).catch(err => {
        if (err) {
            console.log(err)
            res.redirect("/register")
        }
    })
})

app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets")
            })
        }
    })
})

app.get("/logout", (req, res) => {
    req.logout(function (err) {
        if (err) { return next(err); }
    });
    res.redirect("/");
})

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login");
    }
})


app.post("/submit",(req,res)=>{
    const secret = req.body.secret
    // console.log(req.user);
    User.findById(req.user.id).then(founduser=>{
        if (founduser) {
            founduser.secret = secret
            founduser.save().then(()=>{
                res.redirect("/secrets")
            }).catch(err=>{
                console.log(err)
            })
        }
    }).catch(err=>{
        console.log(err)
    })
})





app.listen(3000, () => {
    console.log("Server started at port 3000");
})