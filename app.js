const express = require('express')
      wechat = require('./wechat/wechat')
      config = require('./config')


var app = express()

var wechatApp = new wechat(config) 

app.get('/',function(req,res){
  wechatApp.auth(req,res)
  console.log("444")
 
})
app.post('/',function(req,res){
  
  wechatApp.handleMsg(req,res)
  //wechatApp.uploadPermMertail('news',)
  
})
app.get('/getAccessToken',function(req,res){
  wechatApp.getAccessToken().then(function(data){
    res.send(data)
    console.log("333")
  })
  console.log("允许吧");
})

app.listen(80)
console.log("listening on port:80");