var fs = require('fs');
var ejs = require('ejs');
var mysql = require('mysql');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var passport = require('passport');
var flash = require('connect-flash');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

//DB 설정//
var client = mysql.createConnection({
  host : '203.153.144.75',
  port : 3306,
  user : 'sm14',
  password : 'sm14',
  database : 'sooksmarket'
});

//express 서버객체 생성//
var app = express();

//뷰 엔진 설정//
app.set('views', __dirname);
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname));
app.set('uploadDir', './fileUpload');

//서버 실행
app.listen(80, function(){
  console.log('server running at http://127.0.0.1:80');
});

app.get('/', function(request, response){
  console.log("index.ejs 요청됨");
  response.render('index.ejs');
});


app.get('/sm_signup', function(request, response){
  console.log("signup.ejs파일 읽어옴");
  response.render('sm_signup.ejs');
});

app.post('/sm_signup', function(request, response){
  var body = request.body;
  client.query('INSERT INTO Login (login_name, login_id, login_password, login_email, login_phone) VALUES (?,?,?,?,?)', [body.name, body.id, body.pw, body.email+"@sm.ac.kr", body.phone], function(){
    response.redirect('/');
  });
  console.log(("회원가입 완료"));
});


app.get('/checkId', function(request, response){
  var id = request.query.id;
  var context = {userId : id};

  request.app.render('checkId', context, function(err,html){
    if(err){throw err;}
    response.end(html);
  });
  console.log("checkId파일 읽어옴");
});


app.get('/sm_addItems', function(request, response){
  fs.readFile('sm_addItems.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.post('/sm_addItems', multipartMiddleware, function(request, response){
  var body = request.body;
  var way = body.way;
  var category = body.category;

  if (way == '직거래'){ value = 1; }
  else if (way == '사물함거래'){ value = 2; }
  else{ value = 3; }

  // 파일이 업로드되면 files 속성이 전달됨
  var imageFile = request.files.file;
  var length = request.files.file.length;

  var name = new Array();
  var path = new Array();
  var type = new Array();
  var outputPath = new Array();

  if(!(length > 0) && (request.files.file.size == 0)){  // 파일 0개
    outputPath[0] = ""; outputPath[1] = ""; outputPath[2] = "";
    fs.unlink(request.files.file.path, function(err) { });
  }
  else if(!(length > 0) && (request.files.file.size != 0)){  // 파일 1개
    name[0] = imageFile.name;
    path[0] = imageFile.path;
    type[0] = imageFile.type;

    if(type[0].indexOf('image') != -1) {
        // image 타입이면 이름을 재지정함(현재날짜로)
        outputPath[0] = './fileUpload/' + Date.now() + '_' + name[0];
        fs.rename(path[0], outputPath[0], function(err) {});
    }
    outputPath[1] = ""; outputPath[2] = "";
  }
  else{  // 파일 2개 또는 3개
    for(var i=0; i<length; i++){
      // 업로드 파일이 존재하면
      // 그 파일의 이름, 경로, 타입을 저장
      name[i] = request.files.file[i].name;
      path[i] = request.files.file[i].path;
      type[i] = request.files.file[i].type;

      if(type[i].indexOf('image') != -1) {
          // image 타입이면 이름을 재지정함(현재날짜로)
          outputPath[i] = './fileUpload/' + Date.now() + '_' + name[i];
          fs.rename(path[i], outputPath[i], function(err) {});
      }
    }
    for(var i=length; i<3; i++){
      request.files.file[i] = ""; outputPath[i] = "";
    }
  }
  client.query('INSERT INTO ProductInfo (product_name, product_price, product_category, photo1, photo2, photo3, product_way, product_detail) VALUES (?,?,?,?,?,?,?,?)', [body.name, body.price, category, outputPath[0], outputPath[1], outputPath[2], value, body.detail], function(){
    response.redirect('/');
  });
});

app.get('/sm_main', function(request, response){
  fs.readFile('sm_main.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/sm_itemDetail', function(request, response){
  fs.readFile('sm_itemDetail.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/sm_request', function(request, response){
  fs.readFile('sm_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/t_request', function(request, response){
  fs.readFile('t_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});
