var fs = require('fs');
var ejs = require('ejs');
var bkfd2Password = require("pbkdf2-password");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var hasher = bkfd2Password();
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var flash = require('connect-flash');

var app = express();
var pwdHash;
var password = 1234;
var pwdSalt;
app.listen(80, function(){
  console.log('server running at http://127.0.0.1:80');
});

hasher({password:password}, function(err, pass, salt, hash) {
  pwdHash = hash;
  pwdSalt = salt;
  console.log('\n1---입력 패스워드 :' +1234);
  console.log('\n1---salt :' +pwdSalt);
  console.log('\n1---hash값 :' + pwdHash);
});

hasher({password:password, salt:pwdSalt}, function(err, pass, salt, hash) {
  pwdHash = hash;
  console.log('\n2---입력 패스워드 :' +password);
  console.log('\n2---salt :' +salt);
  console.log('\n2---hash값 :' + pwdHash);
});
