var cors = require('cors');
var fs = require('fs');
var ejs = require('ejs');
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var bkfd2Password = require("pbkdf2-password");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var hasher = bkfd2Password();
var flash = require('connect-flash');
var nodemailer = require('nodemailer');
var multipart = require('connect-multiparty');
var smtpTransport = require("nodemailer-smtp-transport");
var async = require('async');
var moment = require('moment');
var url = require('url');
var cuid = require('cuid');

var multipartMiddleware = multipart();
var loginId = "";
var value =0;
var chatFlag=0;
//DB 설정//
var client = mysql.createConnection({
    host: '203.153.144.75',
    port: 3306,
    user: 'sm14',
    password: 'sm14',
    database: 'sooksmarket'
});
client.connect();

//express 서버객체 생성//
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//뷰 엔진 설정//
app.set('views', __dirname);
app.set('view engine', 'ejs');
app.set('uploadDir', './fileUploads');
app.use(session({
    secret: '1234DSFs@adf1234!@#$asd',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore({
        host: '203.153.144.75',
        port: 3306,
        user: 'sm14',
        password: 'sm14',
        database: 'sooksmarket'
    })
}));

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname));

app.use(passport.initialize());
app.use(passport.session());

app.use(cors());

//서버 실행
// app.listen(80, function() {
//     console.log('server running at http://127.0.0.1:80');
// });

//아이디 중복체크 함수
var idExistence = -1;

var checkUserId = function(id, callback) {

    var exec = client.query('select username from users where username=' + mysql.escape(id), function(err, rows) {
        //console.log('실행대상 SQL :' + exec.sql);

        if (rows.length > 0) {
            idExistence = 1;
            callback(null, rows);
        } else {
            idExistence = 0;
            callback(null, null);
        }
    });
};


app.get('/', function(req, res) {

    var flag = req.user && req.user.displayName;

    if (flag !== undefined) {
      res.redirect('/sm_main');
    } else {

          if(loginFlag === 0) {
            res.render('index', {
              loginon: 0
          }); }
          else if(loginFlag == 1){
            loginFlag =0;
            res.render('index', {
              loginon: 1
          });
          }
          else if(loginFlag == 2){
            loginFlag =0;
            res.render('index', {
              loginon: 2
          });
          }
    }

});

app.get('/sm_enter_main', function(req, res) {
    res.render('sm_enter_main');
});


var unsign = 0;
////--
app.get('/sm_logout', function(req, res) {
  if (unsign === 1){  // 회원탈퇴 시
    async.series([
      function(callback){
        client.query('DELETE FROM ProductInfo WHERE product_seller=?',[loginId[1]], function(err, result){
          callback(null);
        });
      }
    ],
    function(err){
      req.logout();
      client.query('DELETE FROM users WHERE username=?',[loginId[1]], function(err, result){
        unsign = 0;
        res.render('index.ejs', {loginon:0});
      });
    });
  }else{
    req.logout();
    req.session.save(function() {
        res.render('index', {
            loginon: 0
        });
    });
  }
});


app.get('/sm_main', function(req, res) {
  var queryData = url.parse(req.url, true).query;
  //console.log(queryData); //-> <category: '기타', text: 'a^aa'>
  var category = queryData.category;
  var searchText = queryData.text;

  var flag = req.user && req.user.displayName;
  var scrap = [];
  var rows = [];

  var on = 0;
  var allowDate; //신고가 풀리는 날
  var sql;
  var haveCompletion=0;
  var product_id, request_num, tradeInfo;

  product_id = request_num = 0;

  if (flag !== undefined) {
    async.series([
      function(callback){
        sql = 'SELECT * FROM ComplainIdHistory WHERE complainID=? AND date(date)>=date(now())';
        client.query(sql, [flag], function(err, result){
          if(result[0] !== undefined){
            on = 1;
            allowDate = result[0].date;
            //console.log(on);
          }else{
            on = 0;
            //console.log(on);
          }
          callback(null);
        });
      },
      function(callback){
        sql = 'SELECT * FROM ScrapInfo WHERE user=? ORDER BY order_num DESC';
        client.query(sql, [loginId[1]], function(err, result){
          for (var i in result) {
            scrap.push(result[i]);
            // console.log(scrap);
          }
          callback(null);
        });
      },
      function(callback){
        if ((category !== undefined) && (searchText !== '')){  //첫 화면일 때와 입력 없이 버튼을 눌렸을 때 제외!!
          if (category === '전체 검색'){
            sql = 'SELECT * FROM ProductInfo WHERE product_name LIKE ?';
            client.query(sql, ['%' + searchText + '%'], function(err, result) {
              rows = result;
              callback(null);
            });
          }
          else{
            if (searchText !== ''){
              sql = 'SELECT * FROM ProductInfo WHERE product_category=? AND product_name LIKE ?';
              client.query(sql, [category, '%' + searchText + '%'], function(err, result) {
                rows = result;
                callback(null);
              });
            }else{
              sql = 'SELECT * FROM ProductInfo WHERE product_category=?';
              client.query(sql, [category], function(err, result) {
                rows = result;
                callback(null);
              });
            }
          }
        }
        else{
          client.query('SELECT * FROM ProductInfo', function(err, result) {
            rows = result;
            callback(null);
          });
        }
      },

      function(callback){
        sql = 'SELECT * FROM CompletionInfo WHERE username=?';
        client.query(sql, [loginId[1]], function(err, result){
          if(err){throw err;}

          if(result.length===0){
            haveCompletion = product_id = request_num = tradeInfo = 0;
          }else {
            for (var j=0; j<result.length; j++){
              if(result[j].haveCompletion == 1){
                product_id = result[j].product_id;
                haveCompletion = 1;
                break;
              }
            }
          }
          callback(null);
        });
      },

      function(callback){

        if(haveCompletion == 1){
          sql = 'SELECT * FROM FinalTrade WHERE product_id=?';
          client.query(sql, [product_id], function(err, result){
            tradeInfo = result;
          });

          sql = 'SELECT MAX(request_num) as maxRequestNum FROM TradeInfo WHERE product_id=?';
          client.query(sql, [product_id], function(err, result){
            request_num = result[0].maxRequestNum;
            callback(null);
          });
        }else{
        callback(null);
        }
      },

    function(callback) {
      res.render('sm_main.ejs', {
        loginon: 1,
        on: on,
        allowDate: allowDate,
        rows: rows,
        scrap: scrap,
        tradeInfo : tradeInfo,
        product_id : product_id,
        request_num : request_num,
        haveCompletion : haveCompletion
      });
      callback(null);
    }
  ],function(err, results){});

  } else {
    res.render('index', {
      loginon: 0
    });
  }

});


app.post('/sm_main/:id', function(req,res){
  scrapImg = req.body.scrapImg;
  scrapName = req.body.scrapName;
  var photo = [];
  var seller = [];
  var p_id = [];
  var category = [];

 //console.log(req.params.id);
  if(scrapImg === "★"){
    async.series([
      function(callback){
        client.query('SELECT * FROM ProductInfo WHERE product_name=?', [scrapName], function(err, result){
          photo = result[0].photo1;
          seller = result[0].product_seller;
          p_id = result[0].product_id;
          category = result[0].product_category;
          callback(null);
        });
      }
    ],
    function(err){
      var date = getTimeStamp();
      var sql = 'INSERT INTO ScrapInfo (user, scrap_name, scrap_photo, scrap_seller, product_id, order_num, category) VALUES (?,?,?,?,?,?,?)';
      client.query(sql, [loginId[1], scrapName, photo, seller, p_id, date, category], function() {
          res.redirect('/');
      });



    });

  }else if(scrapImg === "☆"){
    client.query('DELETE FROM ScrapInfo WHERE user=? AND scrap_name=?', [loginId[1], scrapName], function() {
        res.redirect('/');
    });
  }
});

passport.serializeUser(function(user, done) {
    //console.log('serializeUser', user);
    done(null, user.authId);
});

passport.deserializeUser(function(id, done) {
    //console.log('deserializeUser', id);
    //console.log("1");
    loginId = id.split(":");
    var sql = 'SELECT * FROM users WHERE authId=?';
    client.query(sql, [id], function(err, results) {
        if (err) {
            console.log(err);
            done(null, false);
        } else {
            done(null, results[0]);
        }
    });
});
passport.use(new LocalStrategy(

    function(username, password, done) {
        //console.log('LocalStrategy 접근');
        var uname = username;
        var pwd = password;
        var sql = 'SELECT * FROM users WHERE authId=?';
        //console.log('query문 접근');
        client.query(sql, ['local:' + uname], function(err, results) {
            var user = results[0];
            //console.log('user값 확인 :', user);
            if (user === undefined) {
                console.log(err);
                return done(null, false);
            }
            //console.log('pwd :', pwd);
            return hasher({
                password: pwd,
                salt: user.salt
            }, function(err, pass, salt, hash) {
                //console.log('해쉬함수 진입');
                //console.log('hash :', hash);
                //console.log('user.passoword :', user.password);
                if (hash === user.password) {
                    //console.log('LocalStrategy', user);
                    done(null, user);
                } else {
                    console.log('err');
                    done(null, false);
                }
            });
        });
    }
));


app.post(
    '/index',
    passport.authenticate(
        'local', {
            successRedirect: '/sm_main',
            failureRedirect: '/',
            failureFlash: false
        }
    )
);


app.get('/sm_signup', function(request, response) {
    var context = {
        idExistence: idExistence
    };
    request.app.render('sm_signup.ejs', context, function(err, html) {
        if (err) {
            throw err;
        }
        response.end(html);
    });
});

app.post('/sm_signup', function(req, res) {
    //console.log('password', req.body.password);
    return hasher({
        password: req.body.password
    }, function(err, pass, salt, hash) {
        var user = {
            authId: 'local:' + req.body.username,
            username: req.body.username,
            password: hash,
            salt: salt,
            displayName: req.body.displayName,
            login_name: req.body.name,
            login_email: req.body.email + '@sm.ac.kr',
            login_phone: req.body.phone
        };

        //users.push(user);
        var sql = 'INSERT INTO users SET ?';
        client.query(sql, user, function(err, result) {
            if (err) {
                console.log(err);
                res.status(500);
            } else { //바로 로그인 하고 싶을 때 추가!!
                // req.login(user,function(err){
                //   req.session.save(function(){
                res.redirect('/');
                //   });
                // });
            }

        });
    });
});

app.get('/checkId', function(request, response) {
    var id = request.query.id;

    readData(id, function() {
        var context = {
            userId: id,
            idExistence: idExistence
        };
        request.app.render('checkId.ejs', context, function(err, html) {
            if (err) {
                throw err;
            }
            response.end(html);
        });
    });
});

var readData = function(id, callback) {
    checkUserId(id, function(err, rows) {
        if (err) {
            throw err;
        }
        callback();
    });
};

var smtpTransport = nodemailer.createTransport(smtpTransport({
    host: "smtp.gmail.com",
    secureConnection: false,
    port: 587,
    auth: {
        user: "miniymay101",
        pass: "sb028390"
    }
}));

var sendCode = function(authenticationCode, email, callback) {
    var mailOptions = {
        from: '숙스마켓 <miniymay101@gmail.com>',
        to: email,
        subject: '숙스마켓 인증번호',
        text: '인증 번호 : ' + authenticationCode
    };

    smtpTransport.sendMail(mailOptions, function(error, response) {
        if (error) {
            console.log(error);
        } else {
            console.log("Message sent : " + response.message);
        }
        smtpTransport.close();
        callback();
    });
};

app.get('/authenticateSookmyung', function(request, response) {
    var email, isExisted, context;
    isExisted = 0;

    var tasks = [
      function(callback){
        email  = request.query.email;
        var sqlQuery = 'SELECT * FROM users WHERE login_email=?';
        client.query(sqlQuery,[email], function(err, result){
          if(err){throw err;}
          if(result.length > 0){
            isExisted = 1;
          }else{
            isExisted = 0;
          }
          callback(null);
        });
      },

      function(callback){
        if(isExisted == 1){
          context = {
            userCode : -1,
            isExisted : isExisted
          };
          request.app.render('authenticateSookmyung.ejs', context, function(err, html) {
              if (err) {
                  throw err;
              }
              response.end(html);
              callback(null);
          });
        }else{
          var authenticationCode = Math.floor(Math.random() * 1000000) + 100000;
          console.log(authenticationCode);
          sendCode(authenticationCode, email, function() {
              context = {
                  userCode: authenticationCode,
                  isExisted : isExisted
              };
              request.app.render('authenticateSookmyung.ejs', context, function(err, html) {
                  if (err) {
                      throw err;
                  }
                  response.end(html);
                  callback(null);
              });
          });
        }
      }
    ];

    async.series(tasks, function(err, result){});
});

function getTimeStamp() {
    var d = new Date();

    var string =
        leadingZeros(d.getFullYear(), 4) + '-' +
        leadingZeros(d.getMonth() + 1, 2) + '-' +
        leadingZeros(d.getDate(), 2) + ' ' +
        leadingZeros(d.getHours(), 2) + ':' +
        leadingZeros(d.getMinutes(), 2) + ':' +
        leadingZeros(d.getSeconds(), 2);

    return string;
}


function leadingZeros(n, digits) {
    var zero = '';
    n = n.toString();

    if (n.length < digits) {
        for (i = 0; i < digits - n.length; i++)
            zero += '0';
    }
    return zero + n;
}


app.get('/sm_itemDetail/:id', function(request, response) {
    var detail_name, detail_price, detail_way, detail_detail, detail_seller, detail_date;
    var detail_photo = [];
    var detail_id = request.params.id; //console.log(request.params.id);  // 1
    var comments = [];
    var sqlQuery, avgRating;

    var reserve_count;
    var sql;
    var btn_delete;
    var reserve_flag;
    var reserve_member;

    if(loginId[1] == undefined){
      response.redirect('/');
    }
    else{
      async.series([
            // 1st
            function(callback) {
                client.query('SELECT * FROM ProductInfo WHERE product_id=?', [detail_id], function(err, result) {
                    //console.log(result);
                    var object = result[0];
                    detail_id = object.product_id;
                    detail_name = object.product_name;
                    detail_price = object.product_price;
                    detail_way = object.product_way;
                    detail_detail = object.product_detail;
                    detail_seller = object.product_seller;
                    detail_date = object.product_date;

                    var photo_split = (object.photo1).substring(1);
                    detail_photo.push(photo_split);
                    photo_split = (object.photo2).substring(1);
                    detail_photo.push(photo_split);
                    photo_split = (object.photo3).substring(1);
                    detail_photo.push(photo_split);

                    callback(null,1);
                });
            },

            function(callback){
              sqlQuery = 'SELECT AVG(starScore) AS avgStar FROM TradeReview WHERE trader=?';
              client.query(sqlQuery, [detail_seller], function(err, result){
                if(err){throw err;}

                if(result.length>0){
                  avgRating = result[0].avgStar;
                }else{
                  avgRating = 0;
                }
                callback(null);
              });
            },

            function(callback) {
                var sql = 'SELECT * FROM comments WHERE product_id=? ORDER BY parent_id DESC,  child_id ASC';
                client.query(sql, detail_id, function(err, rows, fields) {
                    comments = rows;
                    callback(null,2);
                });
            },

            function(callback){
              sql='SELECT MAX(reserve_count) FROM product_reserve WHERE product_id=?';
              client.query(sql, [detail_id], function(err, result){
                if(err){
                  console.log(err);
                } else {
                  reserve_flag=result[0].flag;
                  reserve_count = `${result[0]['MAX(reserve_count)']+1}`;
                  callback(null);
                }
              });
            },

            function(callback){
              sql='SELECT delete_btn FROM btn_state WHERE product_id=?';
              client.query(sql,[detail_id],function(err,result){
                if(err){
                  console.log(err);
                } else {
                  btn_delete=result[0].delete_btn;
                  callback(null,3);
                }
              });
            },
            function(callback){
              sql='SELECT session_id FROM product_reserve WHERE product_id=?';
              client.query(sql,[detail_id],function(err,result){
                if(err){
                  console.log(err);
                } else {
                  reserve_member=result;
                  callback(null,4);
                }
              });
            }
        ],

        // callback (final)
        function(err) {
            response.render('sm_itemDetail.ejs', {
                rows: comments,
                session_id: loginId[1],
                id: detail_id,
                name: detail_name,
                price: detail_price,
                way: detail_way,
                detail: detail_detail,
                seller: detail_seller,
                date: detail_date,
                photo: detail_photo,
                avgRating : avgRating,
                reserve_ordernumber: reserve_count,
                delete_btn : btn_delete,
                reserveMember : reserve_member,
                reserveFlag : reserve_flag

            });
        });
    }
});

app.get('/sm_addItems', function(request, response) {
    response.render('sm_addItems');
});

app.post('/sm_addItems', multipartMiddleware, function(request, response) {
    var body = request.body;
    var way = body.way;
    var category = body.category;
    var detail = body.detail;
    var productId;

    var file = [];
    var name = [];
    var path = [];
    var type = [];
    var outputPath = [];

    var tasks = [
    function(callback) {

    if (way == '직거래') {
        value = 1;
    } else if (way == '사물함거래') {
        value = 2;
    } else {
        value = 3;
    }

    for(var i=0; i<3; i++){
      if(request.files.file[i].size !== 0){
        file.push(request.files.file[i]);
      }
    }


    if (file.length === 0) { // 파일 0개
      for (i = file.length; i < 3; i++) {
          request.files.file[i] = "";
          outputPath[i] = "";
      }
    }
    else { // 파일 2개 또는 3개
      for (var i = 0; i < file.length; i++) { // 업로드 파일이 존재하면

        // 그 파일의 이름, 경로, 타입을 저장
        name[i] = file[i].name;
        path[i] = file[i].path;
        type[i] = file[i].type;

        if (type[i].indexOf('image') != -1) { // image 타입이면 이름을 재지정함(현재날짜로)
          outputPath[i] = './fileUploads/' + name[i] + '_' + Date.now();
          fs.rename(path[i], outputPath[i], function(err) {});
        }
      }
      for (i = file.length; i < 3; i++) {
          request.files.file[i] = "";
          outputPath[i] = "";
      }
    }

    client.query('SELECT * FROM ProductInfo', function(err, result) {
        var length = result.length;
        if (length === 0) {
            console.log("b");
            productId = 1;
        } else {
            productId = (result[length - 1].product_id) + 1;
            console.log(productId);
        }
        callback(null,1);
    });
    console.log(outputPath);
},
function(callback){
  var reserver={
    flag : 0,
    product_id : productId,
    session_id : null,
    reserve_count : 0
  };
  var reserveSql='INSERT INTO product_reserve SET ?';
  client.query(reserveSql,reserver,function(err,result){
    if(err){
      console.log(err);
    }
    callback(null,2);
  });
},
function(callback){
  var state={
    product_id : productId,
    delete_btn : 1
  };
  var stateSql='INSERT INTO btn_state SET ?';
  client.query(stateSql,state,function(err,result){
    if(err){
      console.log(err);
    }
    callback(null,3);
  });
},
function(callback){
  var time = getTimeStamp();
  client.query('INSERT INTO ProductInfo (product_name, product_price, product_category, photo1, photo2, photo3, product_way, product_detail, product_id, product_seller, product_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [body.name, body.price, category, outputPath[0], outputPath[1], outputPath[2], value, detail, productId, loginId[1], time], function() {
      response.redirect('/');
      callback(null,4);
  });
}
];
async.series(tasks, function(err, results) {});
});


app.get('/sm_request/:id', function(request, response) {
    var product_id, product_way, reserve_count;
    var tasks = [
        function(callback) {
            product_id = request.params.id;
            var findTradeWaySql = 'SELECT product_way FROM ProductInfo WHERE product_id=?';
            client.query(findTradeWaySql, [product_id], function(err, result) {
                product_way = result[0].product_way;
                callback(null, product_way);
            });
        },

        function(callback){
          var updatestateSql = 'UPDATE btn_state SET delete_btn=0 WHERE product_id=?';
          client.query(updatestateSql, [product_id],function(err,result){
            if (err) {
                console.log(err);
            }
            callback(null);
          });
        },

        function(callback) {
            var context = {
                id: product_id,
                way: product_way
            };
            request.app.render('sm_request.ejs', context, function(err, html) {
                if (err) {
                    throw err;
                }
                response.end(html);
            });
            callback(null);
        }
    ];
    async.series(tasks, function(err, results) {});
});

app.post('/sm_request/:id', function(request, response) {

    var id, product_id, seller, customer, request_num, requestor, trade_way, product_name, product_price;
    var SqlQuery, state;
    var tasks = [
        function(callback) {
            product_id = request.params.id;
            SqlQuery = 'SELECT product_seller, product_way, product_name, product_price FROM ProductInfo WHERE product_id=?';
            client.query(SqlQuery, [product_id], function(err, result) {
                seller = result[0].product_seller;
                trade_way = result[0].product_way;
                product_name = result[0].product_name;
                product_price = result[0].product_price;
                callback(null);
            });
        },

        function(callback) {
            SqlQuery = 'SELECT MAX(request_num) AS maxRequestNum, customer FROM TradeInfo WHERE product_id=?';

            client.query(SqlQuery, [product_id], function(err, result) {
                if (result[0].customer === null) {
                    customer = loginId[1];
                    request_num = 1;
                    state = 1;
                } else {
                    customer = result[0].customer;
                    request_num = result[0].maxRequestNum + 1;
                    state = 2;
                }
                requestor = loginId[1];

                callback(null);
            });
        },

        function(callback){
          SqlQuery = 'SELECT MAX(id) AS maxId FROM TradeInfo';
          client.query(SqlQuery, function(err, result){
            if(result[0].maxId === null){
              id = 1;
            }else{
              id = result[0].maxId + 1;
            }
            callback(null);
          });
        },

        function(callback) {
            var tradeInfoData = {
                product_id: product_id,
                request_num: request_num,
                seller: seller,
                customer: customer,
                requestor: requestor,
                id : id,
                state : state,
                product_name : product_name,
                product_price : product_price
            };

            SqlQuery = 'INSERT INTO TradeInfo SET ?';
            client.query(SqlQuery, tradeInfoData, function(err, result) {});
            callback(null);
        },

        function(callback) {
            var body = request.body;
            var dayMaxNum = 3;
            var timeMaxNum = 5;
            var trade_date, directPlace, directDetailPlace, lockerDetailPlace, lockerNum, lockerPw;
            var trade_time = [];
            var hour = [];
            var min = [];
            var temp = [];
            var i, j, k,t, tempH, tempM;

            for (i = 0; i < dayMaxNum; i++) {
                trade_date = body["dateText" + i];

                if (trade_date !== undefined) {
                    for (j=0, k=0; k < timeMaxNum; j++, k++) {
                        trade_time[j] = body["timeText" + i + "" + k];
                        //hour[j] = trade_time[j].substring()
                        if (trade_time[j] === undefined){
                            j--;
                        }else{
                            hour[j] = parseInt(trade_time[j].substring(0,2));
                            min[j] = parseInt(trade_time[j].substring(3,5));
                        }
                    }

                    //오름차순 정렬(시간 정렬)
                    for(k=1; k<j; k++){
                      tempH = hour[k];
                      tempM = min[k];
                      for(t=k; t>0; t--){
                        if(hour[t-1]>tempH){
                          hour[t]=hour[t-1];
                          min[t]=min[t-1];
                          if(t==1){
                            hour[t-1]=tempH;
                            min[t-1]=tempM;
                            break;
                          }
                        }else{
                          hour[t]=tempH;
                          min[t]=tempM;
                          break;
                        }
                      }
                    }

                    //분 정렬
                    for(k=0; k<j; k++){
                      for(t=k+1; t<j; t++){
                        if(hour[k]==hour[t]){
                          if(min[k]>min[t]){
                            tempM = min[k];
                            min[k] = min[t];
                            min[t] = tempM;
                          }
                        }
                      }
                    }

                    for(k=0; k<j; k++){
                      if(hour[k]<10){
                        hour[k] = "0"+hour[k];
                      }
                      if(min[k]<10){
                        min[k] = "0"+min[k];
                      }
                      trade_time[k] = hour[k]+":"+min[k];
                    }

                    directDetailPlace = body["directDetailPlace" + i];
                    if (directDetailPlace === undefined) {
                        directPlace = directDetailPlace = null;
                    } else {
                        directPlace = body["place" + i];
                    }

                    lockerDetailPlace = body["lockerDetailPlace" + i];
                    if (lockerDetailPlace === undefined) {
                        lockerDetailPlace = lockerPw = lockerNum = null;
                    } else {
                        lockerNum = body["lockerNum" + i];
                        lockerPw = body["lockerPw" + i];
                        if(lockerPw === ''){
                          lockerPw = null;
                        }
                    }

                    var data = {
                        product_id: product_id,
                        request_num: request_num,
                        trade_date: trade_date,
                        trade_time1: trade_time[0],
                        trade_time2: trade_time[1],
                        trade_time3: trade_time[2],
                        trade_time4: trade_time[3],
                        trade_time5: trade_time[4],
                        trade_way: trade_way,
                        directPlace: directPlace,
                        directDetailPlace: directDetailPlace,
                        lockerDetailPlace: lockerDetailPlace,
                        lockerNum: lockerNum,
                        lockerPw: lockerPw,
                    };

                    SqlQuery = 'INSERT INTO TradeTimePlace SET ?';
                    client.query(SqlQuery, data, function(err, result) {});
                }
                for(t=0; t<5; t++){
                  trade_time[t]=undefined;
                  min[t] = hour[t] = tempM = tempH = 0;
                }
                directPlace = directDetailPlace = lockerDetailPlace = lockerNum = lockerPw = "";
            }
            callback(null);
        },

        function(callback){
          var str=[];
          var msg="";


          if(state == 2){
            str[0] = "<br/><div style='text-align:center;margin:0 auto;'>";
            str[1] = "<strong>시간을 변경하고 싶습니다.</strong>";
          }else{
            str[0] = "<div style='text-align:center;'><div style='text-align:center;margin:0 auto;'>";
            str[1] = product_name+"</div><br/><strong>구매를 요청합니다.</strong>";
          }

          str[2] = "<br/><button type='button' class='btn btn-success' style='margin-top:2%;'";
          str[3] = "onclick='selectTime(\""+loginId[1]+"\",\""+request_num+"\");'>";
          str[4] = "<strong>거래 시간 선택하기</strong></button></div>";

          for(var i=0; i<str.length; i++){
            msg += str[i];
          }

          var m = moment();
          var data = {
            msg_id : loginId[1],
            msg : msg,
            msg_date : m.format("YYYY-MM-DD HH:mm:ss"),
            msg_room : product_id
          };
          SqlQuery = 'INSERT INTO chat_msg SET ?';
          client.query(SqlQuery, data, function(err, result) {
            chatFlag=1;
            if(err){
              console.log(err);
            }
            callback(null,1);
          });
        },

        function(callback){
          var id = request.params.id;
          var str = '/sm_chat/' + id;
          response.redirect(str);
          callback(null,2);
        }
    ];
    async.series(tasks, function(err, results) {
      //console.log("결과 :",results);
    });

});

app.get('/sm_chat/:id', function(req, res) {
  var id, sql, object, seller, customer;
  var context;

  var tasks = [
    function(callback){
      id = req.params.id;
      sql = 'SELECT * FROM TradeInfo WHERE product_id=?';
      client.query(sql, id, function(err, result) {
        if(err){
          console.log(err);
          throw err;
        }
          object = result[0];
          seller = object.seller;
          customer = object.customer;
          callback(null);
      });
    },

    function(callback){
      sql = 'SELECT trade_date, trade_time FROM FinalTrade WHERE product_id=?';
      client.query(sql, [id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }


        if(result[0] === undefined){
          context = {
            product_id: id,
            seller: seller,
            customer: customer,
            session: loginId[1],
            trade_date: 0,
            trade_time: 0
          };
        }
        else{
          context = {
            product_id: id,
            seller: seller,
            customer: customer,
            session: loginId[1],
            trade_date : result[0].trade_date,
            trade_time : result[0].trade_time
          };
        }
        callback(null);
      });
    },

    function(callback){
      res.render('sm_chat.ejs', context);
      callback(null);
    }
  ];

    async.series(tasks, function(err,results){});
});

io.on('connection', function(socket) {
    var result = [];
    var roomname;
    //console.log('1 connection이 이루어졌습니다');

    socket.on('join', function(data) {
       //console.log('join을 서버에서 받았습니다');
        async.series([
                function(callback) {

                    //console.log('2-1 socket.on의 join [서버에서 받음]');
                    socket.user = data.userid;
                    //console.log('2-2 socket.on의 join 받아온값 : ', data);
                    //console.log('socket.on의 join socket : ', socket);
                    roomname = data.room;
                    socket.join(data.room);
                    var sql = 'SELECT * FROM chat_msg WHERE msg_room=? ORDER BY msg_date ASC';
                    client.query(sql, roomname, function(err, results) {
                        if (err) {
                            console.log(err);
                        } else {
                            result = results;
                            //console.log("check1",result);
                        }
                        callback(null, result);
                    });

                },
                function(callback) {
                  if(chatFlag == 1){
                    chatFlag =0;
                    io.emit('second', {
                        'user': socket.user,
                        'msg': result
                    });
                    callback(null, result);
                  } else{
                    io.emit('first', {
                        'user': socket.user,
                        'msg': result
                    });
                    callback(null, result);
                  }
                    //console.log('5 io.emit의 first [클라이언트로 보냄]');

                }
            ],
            function(err, result) {

            });
    });

    socket.on('chat message', function(msg) {
        //console.log('4 socket.on의 chat message [서버에서 받음]');
        //console.log('4', msg);
        var m = moment();
        var msg_date = m.format("YYYY-MM-DD HH:mm:ss");
        var chat = {
            msg_id: socket.user,
            msg: msg,
            msg_date: msg_date,
            msg_room: roomname
        };
        var sql = 'INSERT INTO chat_msg SET ?';
        client.query(sql, chat, function(err, result) {
            if (err) {
                console.log(err);
                res.status(500);
            }
        });
        io.in(roomname).emit('chat message', {
            'user': socket.user,
            'msg': msg,
            'date':msg_date
        });
    });

});

http.listen(80, function() {
    console.log('127.0.0.1');
});

app.get('/sm_chat/:id/reject', function(request, response){
  var product_id, sqlQuery;

  var tasks = [
    function(callback){
        var updatestateSql = 'UPDATE btn_state SET delete_btn=1 WHERE product_id=?';
        client.query(updatestateSql, [product_id],function(err,result){
          if (err) {
              console.log(err);
           }
           callback(null);
        });
      },

    function(callback){
      console.log("진입");
      product_id = request.params.id;
      sqlQuery = 'DELETE FROM TradeInfo WHERE product_id=?';

      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null,1);
      });
    },

    function(callback){
      sqlQuery = 'DELETE FROM TradeTimePlace WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null,2);
      });
    },

    function(callback){
      sqlQuery = 'DELETE FROM chat_msg WHERE msg_room=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null,3);
      });
    },

    function(callback){
      sqlQuery = 'DELETE FROM FinalTrade WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null,4);
      });
    },

    function(callback){
      sqlQuery = 'DELETE FROM CompletionInfo WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null,5);
      });
    },

    function(callback){
      response.redirect('/sm_main');
      callback(null,6);
    }
  ];

  async.series(tasks, function(err,results){});

});

app.get('/sm_changeInfo', function(req, res) {
    var sql = 'SELECT * FROM users  WHERE username=?';
    client.query(sql, loginId[1], function(err, rows, fields) {
        res.render('sm_changeInfo', {
            rows: rows
        });
    });
});

app.post('/sm_changeInfo', function(req, res) {

    return hasher({
        password: req.body.password
    }, function(err, pass, salt, hash) {

        var password = hash;
        var salts = salt;
        var login_phone = req.body.phone;

        //users.push(user);
        var sql = 'UPDATE users SET password=?, salt=?, login_phone=? WHERE username=?';
        client.query(sql, [password, salts, login_phone, loginId[1]], function(err, rows, fields) {
            if (err) {
                console.log(err);
            } else {
                res.redirect('/');
            }
        });
    });

});

app.get('/sm_itemDetail/:id/delete', function(request, response) {
    var id = request.params.id;
    client.query('DELETE FROM ProductInfo WHERE product_id=?', [id], function() {
        response.redirect('/');
    });
}); //삭제

app.get('/sm_changeDetail/:id', function(request, response) {
    var id = request.params.id; //console.log(request.params.id);  // 1
    var before_photo = [];
    var photoState = [];
    var i;

    for(i=0; i<3; i++){
      photoState[i] = -1;
    }

    async.series([
            function(callback) { // 1st
                client.query('SELECT * FROM ProductInfo WHERE product_id=?', [id], function(err, result) {
                    //console.log(result);
                    var object = result[0];
                    before_name = object.product_name;
                    before_price = object.product_price;
                    before_way = object.product_way;
                    before_detail = object.product_detail;
                    before_category = object.product_category;

                    before_photo = [];

                    if(object.photo1 != ""){
                      before_photo.push((object.photo1).substring(1));
                    }
                    if(object.photo2 != ""){
                      before_photo.push((object.photo2).substring(1));
                    }
                    if(object.photo3 != ""){
                      before_photo.push((object.photo3).substring(1));
                    }
                    console.log(before_photo);

                    callback(null, result);
                });
            }
        ],

        function(err, result) { // callback (final)

            response.render('sm_changeDetail.ejs', {
                id: id,
                name: before_name,
                price: before_price,
                photo: before_photo,
                way: before_way,
                category: before_category,
                detail: before_detail,
                photoState : photoState
            });
        });
});

app.post('/sm_changeDetail/:id', multipartMiddleware, function(request, response){
  var body = request.body;   var way = body.way;   var category = body.category;   var detail = body.detail;

  if (way == '직거래'){ value = 1; }
  else if (way == '사물함거래'){ value = 2; }
  else{ value = 3; }

  var file = []; var name = [];   var path = [];  var type = [];  var outputPath = [];
  var hiddenValue = request.body.hidden;

  var change_photo = [];

  async.series([
    function(callback){
      if(hiddenValue == 0){
        client.query('SELECT * FROM ProductInfo WHERE product_id=?', [request.params.id], function(err, result) {
          outputPath[0] = result.photo1;
          outputPath[1] = result.photo2;
          outputPath[2] = result.photo3;

          callback(null);
        });
      }
      else if (hiddenValue == 1){
        for(var i=0; i<3; i++){
          if(request.files.file[i].size !== 0){
            file.push(request.files.file[i]);
          }
        }


        if (file.length === 0) { // 파일 0개
          for (i = file.length; i < 3; i++) {
              request.files.file[i] = "";
              outputPath[i] = "";
          }
        }
        else { // 파일 2개 또는 3개
          for (var i = 0; i < file.length; i++) { // 업로드 파일이 존재하면

            // 그 파일의 이름, 경로, 타입을 저장
            name[i] = file[i].name;
            path[i] = file[i].path;
            type[i] = file[i].type;

            if (type[i].indexOf('image') != -1) { // image 타입이면 이름을 재지정함(현재날짜로)
              outputPath[i] = './fileUploads/' + name[i] + '_' + Date.now();
              fs.rename(path[i], outputPath[i], function(err) {});
            }
          }
          for (i = file.length; i < 3; i++) {
              request.files.file[i] = "";
              outputPath[i] = "";
          }
        } // else 문
        callback(null);
      }
      else if(hiddenValue == 2){
        outputPath[0] = ""; outputPath[1] = ""; outputPath[2] = "";
        callback(null);
      }

    }
  ],
  // callback (final)
  function(err){

    var update = 'UPDATE ProductInfo SET product_name=?, product_price=?, photo1=?, photo2=?, photo3=?, product_way=?, product_detail=? where product_id= ?';
    client.query(update, [body.name, body.price, outputPath[0], outputPath[1], outputPath[2], value, detail, request.params.id], function(){
      var str = '/sm_itemDetail/' + request.params.id;
      response.redirect(str);
    });
  });
});


app.get('/sm_enter_changeInfo', function(req, res) {
    res.render('sm_enter_changeInfo.ejs');
});

app.post('/sm_enter_changeInfo', function(req, res) {
    var sql = 'SELECT * FROM users WHERE username=?';
    client.query(sql, [loginId[1]], function(err, results) {
        var user = results[0];
        if (user === undefined) {
            res.redirect('sm_main');
        }
        return hasher({
            password: req.body.password,
            salt: user.salt
        }, function(err, pass, salt, hash) {
            if (hash === user.password) {
                res.redirect('/sm_changeInfo');
            } else {
                res.redirect('/sm_enter_changeInfo');
            }
        });
    });
});

app.post('/sm_itemDetail/:id/comments', function(req, res) {
    var id;
    var m = moment();
    var parent_id_max;

    async.series([
            function(callback) {

                var sql = 'SELECT MAX(parent_id) FROM comments';
                client.query(sql, function(err, result) {
                    console.log('1번');
                    if (err) {
                        console.log(err);
                        res.status(500);
                    } else {
                        parent_id_max = `${result[0]['MAX(parent_id)']+1}`;
                        //console.log('1번 값',parent_id_max);
                    }
                    callback(null, 1);
                });
            },

            function(callback) {
                id = req.params.id;

                var comment = {
                    product_id: req.params.id,
                    session_id: loginId[1],
                    comment_detail: req.body.comment_detail,
                    comment_date: m.format("YYYY-MM-DD HH:mm"),
                    parent_id: parent_id_max,
                    child_id: 0
                };

                var sql1 = 'INSERT INTO comments SET ?';
                client.query(sql1, comment, function(err, result) {
                    if (err) {
                        console.log(err);
                        res.status(500);
                    }
                    callback(null, 2);
                });

            }
        ],
        function(err, results) {
            var str = '/sm_itemDetail/' + id;
            res.redirect(str);
            //console.log('3번',`${results[0]}`,`${results[1]}`);
        });
});

app.post('/sm_itemDetail/:id/comment/:parent_id/reply', function(req, res) {
    var id = req.params.id;
    var pid = req.params.parent_id;
    var m = moment();
    var contents = req.body.each_comment_detail;
    var child_id_max = 0;
    // console.log('제품 id', id, '상품 부모 id', pid, '내용', contents);

    async.series([
            function(callback) {
                var sql = 'SELECT MAX(child_id) FROM comments WHERE product_id=? AND parent_id=?';
                client.query(sql, [id, pid], function(err, result) {
                    if (err) {
                        console.log(err);
                        res.status(500);
                    } else {
                        child_id_max = `${result[0]['MAX(child_id)']+1}`;
                    }
                    callback(null, 1);
                });
            },

            function(callback) {
                var comment = {
                    product_id: req.params.id,
                    session_id: loginId[1],
                    comment_detail: contents,
                    comment_date: m.format("YYYY-MM-DD HH:mm"),
                    parent_id: pid,
                    child_id: child_id_max,
                };
                var sql1 = 'INSERT INTO comments SET ?';
                client.query(sql1, comment, function(err, result) {
                    if (err) {
                        console.log(err);
                        res.status(500);
                    }
                    callback(null, 2);
                });

            }
        ],
        function(err, results) {
            var str = '/sm_itemDetail/' + id;
            res.redirect(str);
        });
});

app.get('/sm_itemDetail/:id/comment/:parent_id/:child_id/delete', function(req, res) {
    var id = req.params.id;
    var pid = req.params.parent_id;
    var cid = req.params.child_id;
    var sql;

    async.series([
            function(callback) {
                if (cid !== 0) {
                    sql = 'DELETE FROM comments WHERE product_id=? AND parent_id=? AND child_id=?';
                    client.query(sql, [id, pid, cid], function(err, result) {
                        if (err) {
                            console.log(err);
                            res.status(500);
                        }
                        callback(null, 1);
                    });
                } else {
                    sql = 'DELETE FROM comments WHERE parent_id=?';
                    client.query(sql, [pid], function(err, result) {
                        if (err) {
                            console.log(err);
                            res.status(500);
                        }
                        callback(null, 1);
                    });
                }
            }

        ],
        function(err, results) {
            var str = '/sm_itemDetail/' + id;
            res.redirect(str);
        });

});


app.post('/sm_itemDetail/:id/comment/:parent_id/:child_id/edit', function(req, res) {
    var id = req.params.id;
    var pid = req.params.parent_id;
    var cid = req.params.child_id;
    var comment = req.body.comment;

    async.series([
            function(callback) {
                var sql = 'UPDATE comments SET comment_detail=? WHERE product_id=? AND parent_id=? AND child_id=?';
                client.query(sql, [comment, id, pid, cid], function(err, rows, fields) {
                    if (err) {
                        console.log(err);
                    }
                    callback(null, 1);
                });
            }

        ],
        function(err, results) {
            var str = '/sm_itemDetail/' + id;
            res.redirect(str);
        });

});

app.get('/sm_selectTime/:id/:num', function(request, response) {
    var product_id, request_num, sqlQuery;
    var results = "";

    var tasks = [

        function(callback) {
            product_id = request.params.id;
            request_num = request.params.num;
            sqlQuery = 'SELECT * FROM TradeTimePlace WHERE product_id=? AND request_num=? ORDER BY trade_date ASC';
            client.query(sqlQuery, [product_id, request_num], function(err, result) {
                if (err) {
                    console.log(err);
                }
                results = result;
                callback(null);
            });
        },

        function(callback) {
            response.render('sm_selectTime.ejs', {
                results: results,
                id: product_id,
                num: request_num,
                users: loginId[1]
            }, function(err, html) {
                if (err) {
                    throw err;
                }
                response.end(html);
            });
            callback(null);
        }
    ];
    async.series(tasks, function(err, results) {});
});

app.post('/sm_selectTime/:id/:num', function(request, response) {
    var body = request.body;
    var product_id, request_num, sqlQuery, finalQuery;
    var trade_date, trade_time, trade_way, trade_place, seller, customer, id;
    var product_name, product_price;
    var data, isUpdated;
    isUpdated = 0;

    var tasks = [
        function(callback) {
            product_id = request.params.id;
            request_num = request.params.num;
            trade_date = body.finalDate;
            trade_time = body.finalTime;
            trade_way = body.finalTradeWay;

            if (trade_way == "사물함거래") {
                sqlQuery = 'SELECT lockerDetailPlace, lockerNum, lockerPw FROM TradeTimePlace WHERE product_id=? AND request_num=? AND trade_date=?';
                client.query(sqlQuery, [product_id, request_num, trade_date], function(err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        trade_place = result[0].lockerDetailPlace + " " + result[0].lockerNum;
                        if (result[0].lockerPw !== null) {
                            trade_place += " (비번: " + result[0].lockerPw + ")";
                        }
                    }
                    callback(null, 1);
                });
            } else {
                sqlQuery = 'SELECT directPlace, directDetailPlace FROM TradeTimePlace WHERE product_id=? AND request_num=? AND trade_date=?';
                client.query(sqlQuery, [product_id, request_num, trade_date], function(err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        trade_place = result[0].directPlace + " " + result[0].directDetailPlace;
                    }
                    callback(null, 1);
                });
            }
        },

        function(callback) {
            sqlQuery = 'SELECT seller, customer FROM TradeInfo WHERE product_id=? AND request_num=?';
            client.query(sqlQuery, [product_id, request_num], function(err, result) {
                if (err) {
                    console.log(err);
                } else {
                    seller = result[0].seller;
                    customer = result[0].customer;
                }
                callback(null, 2);
            });

        },

        function(callback) {
            sqlQuery = 'SELECT MAX(id) AS maxId FROM FinalTrade';
            client.query(sqlQuery, function(err, result) {
                if (result[0].maxId === null) {
                    id = 1;
                } else {
                    id = result[0].maxId + 1;
                }
                callback(null, 3);
            });
        },

        function(callback) {
            sqlQuery = 'SELECT product_name,product_price FROM ProductInfo WHERE product_id=?';
            client.query(sqlQuery, [product_id], function(err, result) {
                if (err) {
                    console.log(err);
                } else {
                    product_name = result[0].product_name;
                    product_price = result[0].product_price;
                }
                callback(null, 4);
            });
        },

        function(callback) {
            data = {
                id: id,
                product_id: product_id,
                trade_date: trade_date,
                trade_time: trade_time,
                trade_way: trade_way,
                trade_place: trade_place,
                seller: seller,
                customer: customer,
                product_name: product_name,
                product_price: product_price
            };

            sqlQuery = 'SELECT * FROM FinalTrade WHERE product_id=?';
            client.query(sqlQuery, [product_id], function(err, result) {
                if (err) {
                    console.log(err);
                    throw err;
                }

                if (result[0] === undefined) {
                    finalQuery = 'INSERT INTO FinalTrade SET ?';
                    client.query(finalQuery, data, function(err, result) {
                        callback(null, 5);
                    });
                } else {
                    finalQuery = 'UPDATE FinalTrade SET trade_date=?, trade_time=?, trade_way=?, trade_place=? WHERE product_id=?';
                    client.query(finalQuery, [trade_date, trade_time, trade_way, trade_place, product_id], function(err, result) {
                        isUpdated = 1;
                        callback(null, 5);
                    });
                }
            });
        },

        function(callback) {
            sqlQuery = 'UPDATE TradeInfo SET state=? WHERE product_id=? AND request_num=?';
            client.query(sqlQuery, [3, product_id, request_num], function(err, result) {
                callback(null);
            });
        },
        function(callback) {

            if (isUpdated === 0) {
                sqlQuery = 'SELECT MAX(id) as maxId FROM CompletionInfo';
                client.query(sqlQuery, function(err, result) {
                    if (result[0].maxId === null) {
                        id = 1;
                    } else {
                        id = result[0].maxId + 1;
                    }
                    callback(null);
                });
            } else {
                callback(null);
            }
        },

        function(callback){
          if(isUpdated === 0){
            data = {
                id: id,
                username: seller,
                product_id: product_id,
                haveCompletion: 1
            };
            sqlQuery = 'INSERT INTO CompletionInfo SET ?';
            client.query(sqlQuery, data, function(err, result) {
              console.log("진입1");
                callback(null);
            });
          }else{
            callback(null);
          }
        },

        function(callback) {
          console.log("isUpdated", isUpdated);
            if (isUpdated === 0) {

                data = {
                    id: id+1,
                    username: customer,
                    product_id: product_id,
                    haveCompletion: 1
                };
                sqlQuery = 'INSERT INTO CompletionInfo SET ?';

                client.query(sqlQuery, data, function(err, result) {
                  if(err){console.log(err);}
                  console.log("진입2");
                    callback(null);
                });
            } else {
                callback(null);
            }
        },

        function(callback) {
            var msg = "";
            var str = [];

            str[0] = "<br/><strong>[최종거래 확정]</strong><br/><br/>";
            str[1] = product_name;
            str[2] = "<br/><br/>- 가격: " + product_price;
            str[3] = "<br/>- 날짜: " + trade_date + " " + trade_time;
            str[4] = "<br/>- " + trade_way + "<br/>- 위치:" + trade_place;

            for (var i = 0; i < str.length; i++) {
                msg += str[i];
            }

            var m = moment();
            var data = {
                msg_id: loginId[1],
                msg: msg,
                msg_date: m.format("YYYY-MM-DD HH:mm:ss"),
                msg_room: product_id
            };
            sqlQuery = 'INSERT INTO chat_msg SET ?';
            client.query(sqlQuery, data, function(err, result) {
              chatFlag=1;
              console.log("채팅플래그",chatFlag);
                callback(null, 6);
            });
        },

        function(callback) {
            var link = '/sm_chat/' + product_id;
            response.redirect(link);
            callback(null, 7);
        }
    ];

    async.series(tasks, function(err, results) {});
});

app.get('/sm_rejectTrade/:id/:num', function(request, response){
  var product_id, sqlQuery, product_name, request_num;

  var tasks = [
    function(callback){
      product_id = request.params.id;
      request_num = request.params.num;
      sqlQuery = 'SELECT product_name FROM ProductInfo WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
        }else{
          product_name = result[0].product_name;
        }
        callback(null);
      });
    },

    function(callback){
      var context = {
        name : product_name,
        id: product_id,
        num: request_num
      };
      response.render('sm_rejectTrade.ejs',context, function(err, html){
        if(err){
          throw err;
        }
        response.end(html);
        callback(null);
      });
    }
  ];

  async.series(tasks, function(err,results){});
});

app.post('/sm_rejectTrade/:id/:num', function(request, response){
  var product_id, request_num, sqlQuery, product_name, reject_reason;
  var body = request.body;

  var tasks = [

    function(callback){
      product_id = request.params.id;
      request_num = request.params.num;

      sqlQuery = 'SELECT product_name FROM ProductInfo WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
        }else{
          product_name = result[0].product_name;
        }
        callback(null,1);
      });
    },

    function(callback){
      var msg="";
      var str = [];

      reject_reason = body.reason;

      str[0] = "<strong>[거래를 취소합니다]</strong><br/><br/>";
      str[1] = product_name;
      str[2] = "<br/><br/>- 사유 :<br/>"+reject_reason;
      str[3] = "<br/><br/><small><em>※상대방께서는 아래의 거래 취소 확인 버튼을 눌러주세요! 눌러주셔야 거래 취소가 완료됩니다!</em></small>";
      str[4] = "<br/><button type='submit' class='btn btn-success' style='margin-top:2%;'";
      str[5] = "onclick='complete(\""+loginId[1]+"\");'>거래 취소 확인</button>";

      for(var i=0; i<str.length; i++){
        msg += str[i];
      }

      var m = moment();
      var data = {
        msg_id : loginId[1],
        msg : msg,
        msg_date : m.format("YYYY-MM-DD HH:mm:ss"),
        msg_room : product_id
      };
      sqlQuery = 'INSERT INTO chat_msg SET ?';
      client.query(sqlQuery, data, function(err, result) {
        chatFlag=1;
        callback(null,2);
      });
    },

    function(callback){
      var link = '/sm_chat/' + product_id;
      response.redirect(link);
      callback(null,3);
    }
  ];

  async.series(tasks, function(err,results){});
});

app.get('/sm_completeTrade/:id/:num', function(request, response){
  var product_id, sqlQuery, product_name, seller, customer;

  var tasks=[
    function(callback){
      product_id = request.params.id;
      sqlQuery = 'SELECT product_name, seller, customer FROM FinalTrade WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        product_name = result[0].product_name;
        seller = result[0].seller;
        customer = result[0].customer;
        callback(null);
      });
    },

    function(callback){
      var context = {
        seller : seller,
        customer : customer,
        product_name : product_name,
        username : loginId[1]
      };

      response.render('sm_completeTrade.ejs',context, function(err, html){
        if(err){
          console.log(err);
          throw err;
        }
        response.end(html);
        callback(null);
      });
    }
  ];

  async.series(tasks, function(err,results){});
});

app.post('/sm_completeTrade/:id/:num', function(request, response){
  var product_id, id, username, isCompleted, starScore, review, product_name, reason, trader;
  var body, sqlQuery, request_num, isDone;

  isDone = 0;
  body = request.body;

  var tasks = [
    function(callback){
      product_id = request.params.id;
      request_num = request.params.num;
      username = loginId[1];

      sqlQuery = 'SELECT product_name, seller, customer FROM FinalTrade WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        product_name = result[0].product_name;
        if(result[0].seller == username){
          trader = result[0].customer;
        }else{
          trader = result[0].seller;
        }
        callback(null);
      });
    },

    function(callback){
      sqlQuery = 'SELECT MAX(id) as maxId FROM TradeReview';
      client.query(sqlQuery, function(err, result){
        if(result[0].maxId === null){
          id = 1;
        }else{
          id = result[0].maxId + 1;
        }
        callback(null);
      });
    },

    function(callback){
      var m = moment();
      var writtenTime = m.format("MM월 DD일");

      starScore = body.ratingScore;
      review = body.comment;
      isCompleted = body.isCompleted;
      if(isCompleted == '아니요'){
        reason = null;
      }else{
        reason = body.reason;
      }

      if(review === ''){
        review = null;
      }

      sqlQuery = 'INSERT INTO TradeReview SET ?';

      var data = {
        id : id,
        product_id : product_id,
        product_name :product_name,
        trader : trader,
        isCompleted : isCompleted,
        starScore : starScore,
        review : review,
        reason_of_no : reason,
        username : username,
        date : writtenTime
      };

      client.query(sqlQuery, data, function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        callback(null);
      });


    },

    function(callback){
      console.log("들어옴!");
      sqlQuery = 'UPDATE CompletionInfo SET haveCompletion=? WHERE product_id=? AND username=?';
      client.query(sqlQuery, [0, product_id, username], function(err, result){
        if(err){throw err;}
        callback(null);
      });
    },

    function(callback){
      sqlQuery = 'SELECT username FROM TradeReview WHERE product_id=?';
      client.query(sqlQuery, [product_id], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        if(result.length == 2){
          isDone = 1;
        }
        callback(null);
      });
    },

    function(callback){
      if(isDone == 1){
        sqlQuery = 'DELETE FROM TradeTimePlace WHERE product_id=?';
        client.query(sqlQuery, [product_id], function(err, result){
          if(err){throw err;}
        });

        sqlQuery = 'DELETE FROM chat_msg WHERE msg_room=?';
        client.query(sqlQuery, [product_id], function(err, result){
          if(err){throw err;}
        });

        sqlQuery = 'UPDATE TradeInfo SET state=? WHERE product_id=?';
        client.query(sqlQuery, [4, product_id], function(err, result){
          if(err){throw err;}
          callback(null);
        });
      }else{
        callback(null);
      }
    },

    function (callback) {
      var link = '/sm_tradeStateDetail/' + product_id + '/' + request_num;
      response.redirect(link);
      callback(null);
    }
  ];

  async.series(tasks, function(err, results){});
});

app.get('/sm_scrap', function(req,res){
  client.query('SELECT * FROM ScrapInfo WHERE user=?',[loginId[1]], function(err, result){
    res.render('sm_scrap.ejs',{result:result});
  });
});

app.get('/sm_complain', function(req, res){
  var flag = 0;
  var sql = 'SELECT * FROM users WHERE username=?';
  client.query(sql, [loginId[1]], function(err, result){
    if(result.length > 0){
      res.render('sm_complain.ejs', {userID:loginId[1]});
    }
    else{
      res.redirect('404.html');
    }
  });
});

app.post('/sm_complain', function(req, res){
  // console.log(req.params); //sy
  var body = req.body;
  var userID = loginId[1];
  var complainID = body.complainID;
  var detail = body.detail;

  var flag = 0;

  async.series([
    function(callback) {
      var sql = 'SELECT * FROM users WHERE username LIKE ?';
      client.query(sql, [complainID], function(err, result) {
        if(result !== ''){
          flag = 1;
        }
        callback(null, flag);
      });
    }
  ],

  function(err, flag) {
    if(flag == 1){
      var time = getTimeStamp();
      var sql = 'INSERT INTO complainInfo (userID, complainID, detail, date, flag) VALUES (?,?,?,?,?)';
      client.query(sql, [userID, complainID, detail, time, 0], function() {
          res.render('sm_complain.ejs', {userID:loginId[1]});
      });
    }
    else if(flag === 0){
      res.render('sm_complain.ejs', {userID:loginId[1]});
    }
  });
});

app.get('/sm_complainList', function(req, res){
  var sql;

  if('sooksmarket' == loginId[1]){ //관리자일 경우
    var queryData = url.parse(req.url, true).query;
    var category = req.query.category;
    var searchText = req.query.text;

    var flag = 0; //승낙버튼 처리 안한 경우

    async.series([
      function(callback){
        if ((category !== undefined) && (searchText !== '')){  //첫 화면일 때와 입력 없이 버튼을 눌렸을 때 제외!!
          if (category === '전체 검색'){
            sql = 'SELECT * FROM complainInfo WHERE userID OR detail LIKE ? ORDER BY auto DESC';
            client.query(sql, ['%' + searchText + '%', '%' + searchText + '%'], function(err, result) {
              callback(null, result);
            });
          }
          else{
            if ((searchText !== '') && (category == '신고자ID')){
              sql = 'SELECT * FROM complainInfo WHERE userID LIKE ? ORDER BY auto DESC';
              client.query(sql, ['%' + searchText + '%'], function(err, result) {
                callback(null, result);
              });
            }
            else if ((searchText !== '') && (category == '사유')){
              sql = 'SELECT * FROM complainInfo WHERE detail LIKE ? ORDER BY auto DESC';
              client.query(sql, ['%' + searchText + '%'], function(err, result) {
                callback(null, result);
              });
            }
          }
        }
        else{
          client.query('SELECT * FROM complainInfo ORDER BY auto DESC', function(err, result) {
            callback(null, result);
          });
        }
      }
    ],
    function(err, row){
      res.render('sm_complainList.ejs', {admin: 'sooksmarket', session: loginId[1], rows: row[0]});
    });
  }
  else{  //사용자일 경우
    client.query('SELECT * FROM complainInfo WHERE userID=? ORDER BY auto DESC', [loginId[1]],function(err, result) {
      res.render('sm_complainListUser.ejs', {rows:result});
    });
  }
});

app.get('/sm_complainDetail/:num', function(req, res){
  var sql = 'SELECT * FROM complainInfo WHERE auto=?';
  client.query(sql, [req.params.num], function(err, row){
    res.render('sm_complainDetail.ejs', {row: row});
  });
});


function ProhibitAccessTime() {
    var d = new Date();
    var month = (d.getMonth() + 1)+1;
    var year = d.getFullYear();

    if (month == 13){
      month = d.getMonth(d.setMonth((d.getMonth() + 1)+1));  // 한 달 동안 사용 못 함
      year = year+1;
    }

    var string =
        leadingZeros(year, 4) + '-' +
        leadingZeros(month, 2) + '-' +
        leadingZeros(d.getDate(), 2);

    return string;
}

var sendMessage = function(email, callback) {
    var mailOptions = {
        from: '숙스마켓 <miniymay101@gmail.com>',
        to: email,
        subject: '[숙스마켓] 아래와 같은 이유로 당신은 한달간 사용이 정지됩니다.',
        text: '다음과 같은 이유로 사용 정지!!'
    };

    smtpTransport.sendMail(mailOptions, function(error, response) {
        if (error) {
            console.log(error);
        } else {
            console.log("Message sent : " + response.message);
        }
        smtpTransport.close();
        callback();
    });
};

app.get('/sm_complainOK/:id', function(req, res) {
  var row = [];
  var OK = 0;

  var queryData = url.parse(req.url, true).query;
  var auto = req.query.auto;
  //console.log(auto);

  async.series([
    function(callback){
      var str = 'SELECT * FROM complainInfo WHERE auto=?';
      client.query(str, [auto], function(err, result){
        row = result[0];
        callback(null);
      });
    },
    function(callback){
      var str = 'UPDATE complainInfo SET flag=? WHERE auto=?';
      client.query(str, [1, auto], function(err, result) {
        callback(null);
      });
    },
    function(callback){
      var str = 'SELECT * FROM ComplainIdHistory WHERE complainID=?';
      client.query(str, [row.complainID], function(err, result){
        if(result[0] !== undefined){ // 이미 있을 때
          OK = 1;
        }
        callback(null);
      });
    },
    function(callback){
      if(OK !== 0){ // 이미 history DB에 있으면
        callback(null);
      }
      else{
        var email = "sooksmarket@sm.ac.kr";
        sendMessage(email, function() {
          console.log("메일보냄");
        });

        var time = ProhibitAccessTime();
        var str = 'INSERT INTO ComplainIdHistory (complainID, date, reason) VALUES (?,?,?)';
        client.query(str, [row.complainID, time, row.detail], function(err, result){
          callback(null);
        });
      }
    }
  ],
  function(err){
    client.query('SELECT * FROM complainInfo ORDER BY auto DESC', function(err, result) {
       res.render('sm_complainList.ejs', {admin: 'sooksmarket', session: loginId[1], rows: result});
    });
  });

});

app.get('/sm_suggest', function(req, res){
  var flag = 0;
  var sql = 'SELECT * FROM users WHERE username=?';
  client.query(sql, [loginId[1]], function(err, result){
    if(result.length > 0){
      res.render('sm_suggest.ejs', {userID:loginId[1]});
    }
    else{
      res.redirect('404.html');
    }
  });
});

app.post('/sm_suggest', function(req, res){
  var body = req.body;
  var userID = loginId[1];
  var comment = body.comment;

  var time = getTimeStamp();
  var sql = 'INSERT INTO suggestInfo (userID, comment, date) VALUES (?,?,?)';
  client.query(sql, [userID, comment, time], function() {
      res.redirect('/');
  });
});

app.get('/sm_suggestList', function(req, res){
  if('sooksmarket' == loginId[1]){ //관리자일 경우
    client.query('SELECT * FROM suggestInfo ORDER BY auto DESC', function(err, row) {
      res.render('sm_suggestList.ejs', {admin: 'sooksmarket', session: loginId[1], rows: row});
    });
  }
  else{  //사용자일 경우
    client.query('SELECT * FROM suggestInfo WHERE userID=? ORDER BY auto DESC', [loginId[1]],function(err, row) {
      res.render('sm_suggestListUser.ejs', {rows:row});
    });
  }
});

app.get('/sm_suggestDetail/:num', function(req, res){
  var sql = 'SELECT * FROM suggestInfo WHERE auto=?';
  client.query(sql, [req.params.num], function(err, row){
    res.render('sm_suggestDetail.ejs', {row: row});
  });
});

app.get('/category/:id', function(req, res){
  var option = req.params.id;
  var queryData = url.parse(req.url, true).query;
  var searchText = queryData.text;

  var flag = req.user && req.user.displayName;
  var scrap = [];
  var rows = [];

  var on = 0;
  var allowDate; //신고가 풀리는 날
  var photo = [];

  if (flag !== undefined) {
    async.series([
      function(callback){
        var sql = 'SELECT * FROM ComplainIdHistory WHERE complainID=? AND date(date)>=date(now())';
        client.query(sql, [flag], function(err, result){
          if(result[0] !== undefined){
            on = 1;
            allowDate = result[0].date;
          }else{
            on = 0;
          }
          callback(null);
        });
      },

      function(callback){
        var sql = 'SELECT * FROM ScrapInfo WHERE user=? AND category=? ORDER BY order_num DESC';
        client.query(sql, [loginId[1], option], function(err, result){
          for (var i in result) {
            scrap.push(result[i]);
          }
          callback(null);
        });
      },

      function(callback){
        if ((searchText !== '') && (searchText !== undefined)){
          var sql = 'SELECT * FROM ProductInfo WHERE product_category=? AND product_name LIKE ?';
          client.query(sql, [option, '%' + searchText + '%'], function(err, result) {
            rows = result;
            for(var i in result){
              photo.push((result[i].photo1).substring(1));
            }
            callback(null);
          });
        }else{
          client.query('SELECT * FROM ProductInfo WHERE product_category=?', [option], function(err, result){
            for(var i in result){
              photo.push((result[i].photo1).substring(1));
            }
            rows = result;
            callback(null);
          });
        }
      }
    ],
    function(err) {
      res.render('category.ejs', {
        loginon: 1,
        on: on,
        allowDate: allowDate,
        rows: rows,
        scrap: scrap,
        photo:photo,
        option: option
      });
    });

  } else {
    res.render('index', {
      loginon: 0
    });
  }

});
///category/
app.post('/category/:id', function(req,res){
  scrapImg = req.body.scrapImg;
  scrapName = req.body.scrapName;
  var photo = [];
  var seller = [];
  var p_id = [];

 //console.log(req.params.id);
  if(scrapImg === "★"){
    async.series([
      function(callback){
        client.query('SELECT * FROM ProductInfo WHERE product_name=?', [scrapName], function(err, result){
          photo = result[0].photo1;
          seller = result[0].product_seller;
          p_id = result[0].product_id;
          callback(null);
        });
      }
    ],
    function(err){
      var sql = 'INSERT INTO ScrapInfo (user, scrap_name, scrap_photo, scrap_seller, product_id, order_num) VALUES (?,?,?,?,?,?)';
      client.query(sql, [loginId[1], scrapName, photo, seller, p_id, req.params.id], function() {
          res.redirect('/');
      });
    });

  }else if(scrapImg === "☆"){
    client.query('DELETE FROM ScrapInfo WHERE user=? AND scrap_name=?', [loginId[1], scrapName], function() {
        res.redirect('/');
    });
  }
});

app.get('/sm_tradeState', function(request, response){
  var sqlQuery, haveCompletion;
  var sessionId = loginId[1];
  var searchResults = [];
  var isExisted = 0;

  var tasks = [
    function(callback){
      sqlQuery = 'SELECT * FROM TradeInfo a WHERE seller=? OR customer=? ORDER BY id DESC';
      client.query(sqlQuery, [sessionId, sessionId], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }

        searchResults[0] = result[0];
        for(var i=1; i<result.length; i++){
          for(var j=0; j<searchResults.length; j++){
            if(searchResults[j].product_id == result[i].product_id){
              isExisted = 1;
            }
          }
          if(isExisted !=1){
            searchResults[j] = result[i];
          }else{
            isExisted = 0;
          }
        }
        callback(null);
      });
    },

    function(callback){
      response.render('sm_tradeState.ejs',{
        results : searchResults,
        id : sessionId
      },function(err,html){
        if(err)
          throw err;
        response.end(html);
        callback(null);
      });
    }
  ];
  async.series(tasks, function(err,results){});
});

app.get('/sm_tradeStateDetail/:id/:num', function(request, response){
  var product_id, request_num, results, sessionId;
  var sqlQuery, finalTradeInfo;
  var context;

  var tasks = [
    function(callback){
      product_id = request.params.id;
      request_num = request.params.num;
      sessionId = loginId[1];
      sqlQuery = 'SELECT * FROM TradeInfo WHERE product_id=? AND request_num=?';

      client.query(sqlQuery, [product_id, request_num], function(err, result){
        if(err){
          console.log(err);
          throw err;
        }
        results = result;
        callback(null);
      });
    },

    function(callback){
      if(results[0].state == 3){
        sqlQuery = 'SELECT * FROM FinalTrade WHERE product_id=?';
        client.query(sqlQuery, [product_id], function(err, result){
          if(err){
            console.log(err);
            throw err;
          }
          finalTradeInfo = result;
          callback(null);
        });
      }else{
        finalTradeInfo = 0;
        callback(null);
      }
    },

    function(callback){
      sqlQuery = 'SELECT haveCompletion FROM CompletionInfo WHERE username=? AND product_id=?';
      client.query(sqlQuery, [sessionId, product_id], function(err, result){
        if(err){throw err;}
        if(result.length === 0){
          haveCompletion = 0;
        }else{
          haveCompletion = result[0].haveCompletion;
        }
        callback(null);
      });
    },

    function(callback){
      context = {
        results : results,
        id : sessionId,
        final : finalTradeInfo,
        haveCompletion : haveCompletion
      };
      response.render('sm_tradeStateDetail.ejs',context,function(err,html){
        if(err)
          throw err;
        response.end(html);
        callback(null);
      });
    }
  ];
  async.series(tasks, function(err,results){});
});

app.get('/sm_review', function(request, response){
  var sqlQuery, sqlResults, context;

  var tasks = [
    function(callback){
      sqlQuery = 'SELECT trader, starScore, review, username, date FROM TradeReview ORDER BY id DESC';
      client.query(sqlQuery, function(err, result){
        if(err){throw err;}
        sqlResults = result;
        callback(null);
      });
    },

    function(callback){
      context = {
        results : sqlResults,
        notExist: 0
      };
      response.render('sm_review.ejs',context,function(err,html){
        if(err)
          throw err;
        response.end(html);
        callback(null);
      });
    }
  ];

  async.series(tasks, function(err, result){});
});


app.get('/sm_review/search/:id', function(request, response){
  var searchId, sqlQuery, sqlResults;
  var notExist = 0;

  var tasks = [
    function(callback){
      searchId = request.params.id;
      sqlQuery = 'SELECT trader, starScore, review, username, date FROM TradeReview WHERE trader=? ORDER BY id DESC';

      client.query(sqlQuery, [searchId], function(err, result){
        if(err){throw err;}

        if(result.length > 0){
          sqlResults = result;
        }else{
          notExist = 1;
          sqlResults = 0;
        }
        callback(null);
      });
    },

    function(callback){
      context = {
        results : sqlResults,
        notExist: notExist
      };
      response.render('sm_review.ejs',context,function(err,html){
        if(err)
          throw err;
        response.end(html);
        callback(null);
      });
    }
  ];

  async.series(tasks, function(err, result){});
});


app.get('/sm_request/:id/reserve/:sid',function(req,res){
  var product_id = req.params.id;
  var session_id = req.params.sid;
  var reserve_count;
  var sql;
  var reserve_member;
  var length;

    var tasks = [
        function(callback){
          sql='SELECT MAX(reserve_count) FROM product_reserve WHERE product_id=?';
          client.query(sql, [product_id], function(err, result){
            if(err){
              console.log(err);
            } else {
              reserve_count = `${result[0]['MAX(reserve_count)']+1}`;
              callback(null);
            }
          });
        },
        function(callback){
          var reserve={
            flag : 0,
            product_id : product_id,
            session_id : session_id,
            reserve_count : reserve_count
          };
          sql='INSERT INTO product_reserve SET ?';
          client.query(sql,reserve,function(err,result){
            if(err){
              console.log(err);
            } else{
              var link = '/sm_itemDetail/'+product_id;
              res.redirect(link);
              callback(null);
            }
          });
        }
        // function(callback) {
        //   sql='UPDATE product_reserve SET reserve_count=? WHERE product_id=?';
        //   client.query(sql, [reserve_count ,product_id], function(err, rows, fields){
        //     if(err){
        //       console.log(err);
        //     } else {
        //       var link = '/sm_itemDetail/'+product_id;
        //       res.redirect(link);
        //       callback(null,2);
        //     }
        //   });
        // }
      ];
      async.series(tasks, function(err, results) {});
});

app.get('/sm_request/:id/cancel',function(req,res){
  var product_id = req.params.id;
    var tasks = [
      function(callback){
        var updatestateSql = 'UPDATE btn_state SET delete_btn=1 WHERE product_id=?';
        client.query(updatestateSql, [product_id],function(err,result){
          if (err) {
              console.log(err);
          } else {
            var link = '/sm_itemDetail/'+product_id;
            res.redirect(link);
            callback(null);
          }
        });
      }
    ];
    async.series(tasks, function(err, results) {});
});

app.get('/find', function(req, res){
  res.render('find.ejs');
});

app.post('/find/:type', function(req, res){
  var type = req.params.type;

  if(type === "id"){
    if(req.body.id != undefined){
      var login_email = req.body.id + '@sm.ac.kr';
      var str = 'SELECT * FROM users WHERE login_email=?';

      client.query(str, [login_email], function(err, result){  //console.log(result[0]);
        if(result[0] != undefined){
          sendId(result[0].username, login_email, function() {
            console.log("메일보냄");
          });
        }
      });
    }
  }
  else if (type === "pwd"){
    if(req.body.pwd != undefined){
      var login_email = req.body.pwd + '@sm.ac.kr';
      var str = 'SELECT * FROM users WHERE login_email=?';
      var tempPass = cuid.slug();

      async.series([
        function(callback){
          client.query(str, [login_email], function(err, result){  //console.log(result[0]);
            if(result[0] != undefined){
              sendPwd(tempPass, login_email, function() {
                console.log("메일보냄11");
              });
            }
            callback(null);
          });
        }
      ],
      function(err){
        return hasher({
            password: tempPass
        }, function(err, pass, salt, hash) {

            var password = hash;
            var salts = salt;

            //users.push(user);
            var sql = 'UPDATE users SET password=?, salt=? WHERE login_email=?';
            client.query(sql, [password, salts, login_email], function(err, result) {
            });
          });
        });

      }
    }

});

var sendId = function(id, email, callback) {
  var style='<div style="border: 1px solid #d6d6d6; padding: 16px; text-align:center">';
    var mailOptions = {
        from: '숙스마켓 <miniymay101@gmail.com>',
        to: email,
        subject: '[숙스마켓] 아이디 찾기',
        html:style+'<h5 style="background-color:#ff9999">등록된 ID : </h5>'+'<h1>' + id+'</h1></div>'
    };

    smtpTransport.sendMail(mailOptions, function(error, response) {
        if (error) {
            console.log(error);
        } else {
            console.log("Message sent : " + response.message);
        }
        smtpTransport.close();
        callback();
    });
};

var sendPwd = function(pwd, email, callback) {
  var style='<div style="border: 1px solid #d6d6d6; padding: 16px; text-align:center">';
    var mailOptions = {
        from: '숙스마켓 <miniymay101@gmail.com>',
        to: email,
        subject: '[숙스마켓] 비밀번호 찾기',
        html:style+'<h5 style="background-color:#ff9999">임시비밀번호 : </h5>'+'<h1>' + pwd+'</h1></div>'
    };

    smtpTransport.sendMail(mailOptions, function(error, response) {
        if (error) {
            console.log(error);
        } else {
            console.log("Message sent : " + response.message);
        }
        smtpTransport.close();
        callback();
    });
};

app.get('/sm_unsign', function(req, res){
  res.render('sm_unsign.ejs', {flag:0});
});

app.post('/sm_unsign', function(req, res){
  var str = 'SELECT * FROM TradeInfo WHERE (seller=? AND state<4) OR (customer=? AND state<4)';
  var flag = 0;

  async.series([
    function(callback){
      client.query(str, [loginId[1], loginId[1]], function(err, result){
        //console.log(result[0]);
        if(result[0] == undefined){  // 거래 중이 아닐 때
          flag = 1;
        }
        callback(null);
      });
    }
  ],
  function(err){
    if(flag === 1){
      //res.redirect('sm_logout');
      res.render('sm_unsign.ejs', {flag:1});
      unsign = 1;
    }
    else{
      res.render('sm_unsign.ejs', {flag:2});
    }
  });
});
