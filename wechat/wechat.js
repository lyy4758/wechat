'use strict'

const crypto = require('crypto'),
 https = require('https'),
  util = require('util'),
 fs = require('fs'),
 urltil = require('url'),
 menus = require ('./menus'),
parseString = require('xml2js').parseString,
  msg = require('./msg'),
CryptoGraphy = require('./cryptoGraphy'),
accessTokenJson = require('./access_token'),
Promise = require ('bluebird'),
request = Promise.promisify(require('request')),


Wechat = function(config){
  this.config = config
  this.token = config.token
  this.appID = config.appID
  this.appSecret = config.appSecret
  this.apiDomain = config.apiDomain
  this.apiURL = config.apiURL

  this.requestGet = function(url){
    return new Promise(function(resolve,reject){
      https.get(url,function(res){
        var buffer = [],result = ""
        res.on('data',function(data){
          buffer.push(data)
        })
        res.on('end',function(){
          result = Buffer.concat(buffer).toString('utf-8')
          resolve(result)
        })
      }).on('error',function(err){
        reject(err)
      })
    })
  }
  this.requestPost = function(url,data){
    // return new Promise(function(resolve,reject){
    //   var urlData = urltil.parse(url)
    //   var options ={
    //     hostname:urlData.hostname,
    //     path:urlData.path,
    //     method:'POST',
    //     headers:{
    //       'Content-Type':'application/x-www-form-urlencoded',
    //       'Content-Length':Buffer.byteLength(data,'utf-8')
    //     }
    //   }
    //   var req = https.request(options,function(res){
    //     var buffer = [],result = ''
    //     res.on('data',function(data){
    //       buffer.push(data)
    //     })
    //     res.on('end',function(){
    //       result = Buffer.concat(buffer).toString('utf-8')
    //       resolve(result)
    //     })
    //   })
    //   .on('error',function(err){
    //     console.log("err");
    //     reject(err)
    //   })
    //   req.write(data)
    //   req.end()
    // })
    return new Promise(function (resolve, reject) {
      request.post({
        url: url,
        formData: data
      }, function (err, httpResponse, body) {
        resolve(body);
      })
    })
  }

}

Wechat.prototype.auth = function(req,res){
  var that = this
      this.getAccessToken().then(function(data){
        var url = util.format(that.apiURL.createMenu,that.apiDomain,data)
        that.requestPost(url,JSON.stringify(menus)).then(function(data){
          console.log(data)
        })
      })
  var signature = req.query.signature,
      timestamp = req.query.timestamp,
      nonce = req.query.nonce,
      echostr = req.query.echostr
  var arry = [this.token,timestamp,nonce]//浪费时间this
  arry.sort()

  var tempStr = arry.join('')
  const hashCode = crypto.createHash('sha1')
  var resultCode = hashCode.update(tempStr,'utf8').digest('hex')


  if(resultCode === signature){
    res.send(echostr)
  }else{
    res.send('这是杨柳大神的网站，just for fun')
  }
}

Wechat.prototype.getAccessToken = function(){
  var that = this
  return new Promise(function(resolve,reject){
    var currentTime = new Date().getTime()
    var url = util.format(that.apiURL.accessTokenApi,that.apiDomain,that.appID,that.appSecret)
    if(accessTokenJson.access_token === "" || accessTokenJson.expires_time<currentTime){
      that.requestGet(url).then(function(data){
        console.log("0000")
        var result = JSON.parse(data)
        if(data.indexOf("errcode")<0){
          accessTokenJson.access_token = result.access_token
          accessTokenJson.expires_time = new Date().getTime() + (parseInt(result.expires_in)-200) *1000 
          fs.writeFile('./wechat/access_token.json',JSON.stringify(accessTokenJson))
          console.log("写入成功");
          resolve(accessTokenJson.access_token)
        }else{
          console.log("错误");
          resolve(result)
        }
      })
    }else{
      resolve(accessTokenJson.access_token)
      console.log("本地有效");
    }
  })
}
Wechat.prototype.handleMsg = function(req,res){
    var buffer = [],that = this;

    //实例微信消息加解密
    var cryptoGraphy = new CryptoGraphy(that.config,req);

    //监听 data 事件 用于接收数据
    req.on('data',function(data){
        buffer.push(data);
    });
    //监听 end 事件 用于处理接收完成的数据
    req.on('end',function(){
        var msgXml = Buffer.concat(buffer).toString('utf-8');
        //解析xml
        parseString(msgXml,{explicitArray : false},function(err,result){
            if(!err){
                result = result.xml;
                //判断消息加解密方式
                if(req.query.encrypt_type == 'aes'){
                    //对加密数据解密
                    result = cryptoGraphy.decryptMsg(result.Encrypt);
                }
                var toUser = result.ToUserName; //接收方微信
                var fromUser = result.FromUserName;//发送仿微信
                var reportMsg = ""; //声明回复消息的变量   

                //判断消息类型
                if(result.MsgType.toLowerCase() === "event"){
                    //判断事件类型
                    switch(result.Event.toLowerCase()){
                        case 'subscribe':
                            //回复消息
                            var content = "欢迎关注广州荣知通公众号，一起斗图吧。回复以下数字：\n";
                                content += "1.公司介绍\n";
                                content += "2.公司产品\n";
                                content += "回复 “文章”  可以得到图文推送哦~\n";
                            reportMsg = msg.txtMsg(fromUser,toUser,content);
                        break;
                        case 'click':
                             var contentArr = [
                                {Title:"公司介绍",Description:"广州荣知通信息科技有限公司成立于2016年, 是一家致力于工业智能化领域产品研发、生产、销售和售后服务为一体的高科技企业。",PicUrl:"http://rztit.com/images/company/2.jpg",Url:"http://rztit.com"},
                                {Title:"主要产品",Description:"公司的主要产品",PicUrl:"http://rztit.com/images/portfolio/product/index/xssb.jpg",Url:"http://rztit.com/product"},
                                {Title:"公司动态",Description:"公司活动动态",PicUrl:"http://rztit.com/images/activity/2017/EndSprint/17101.jpg",Url:"http://rztit.com/news"}
                            ];
                            //回复图文消息
                            reportMsg = msg.graphicMsg(fromUser,toUser,contentArr);
                        break;
                    }
                }else{
                     //判断消息类型为 文本消息
                    if(result.MsgType.toLowerCase() === "text"){
                        //根据消息内容返回消息信息
                        switch(result.Content){
                            case '1':
                                reportMsg = msg.txtMsg(fromUser, toUser, '广州荣知通信息科技有限公司成立于2016年, 是一家致力于工业智能化领域产品研发、生产、销售和售后服务为一体的高科技企业。');
                            break;
                            case '2':
                                reportMsg = msg.txtMsg(fromUser, toUser, 'http://rztit.com/product');
                            break;
                            case '文章':
                                var contentArr = [
                                {Title:"公司介绍",Description:"广州荣知通信息科技有限公司成立于2016年, 是一家致力于工业智能化领域产品研发、生产、销售和售后服务为一体的高科技企业。",PicUrl:"http://rztit.com/images/company/2.jpg",Url:"http://rztit.com"},
                                {Title:"主要产品",Description:"公司的主要产品",PicUrl:"http://rztit.com/images/portfolio/product/index/xssb.jpg",Url:"http://rztit.com/product"},
                                {Title:"公司动态",Description:"公司活动动态",PicUrl:"http://rztit.com/images/activity/2017/EndSprint/17101.jpg",Url:"http://rztit.com/news"}
                            ];
                                //回复图文消息
                                reportMsg = msg.graphicMsg(fromUser,toUser,contentArr);
                            break;
                            case 'massSend':
                                // var mpnews = {
                                //   media_id: 'ezs27f6_5PiYY5VYZNb7afdfEUkLJ_XMZRCR8vSgNEk'
                                // }
                                var msg1 = that.massSendMsg('mpnews');
                                console.log('msg:' + JSON.stringify(msg1));
                            break;
                            case "uploadPic":
                                var urlPath = (__dirname,"./wechat/pic/king.jpg")
                                that.uploadPicture(urlPath,"image").then(function (media_id) {
                                  reportMsg = msg.imageMsg(fromUser,toUser,media_id)
                                  console.log(media_id)
                                  fs.appendFile('./wechat/media_id.json', media_id + urlPath + "分割线||||    ",'utf-8',function(err){console.log(err)})
                                   })
                            break;
                            case 'pic':
                                reportMsg = msg.imageMsg(fromUser, toUser, 'ezs27f6_5PiYY5VYZNb7aQ6MoXU1VWyz4x7hwU5DuZY')
                                break;
                            case 'uploadNews':
                                   // var data = that.uploadPermMaterial('image')
                                    //  var articles = [{
                                    //    title: "金刚zsd",
                                    //    thumb_media_id: 'ezs27f6_5PiYY5VYZNb7aariApk7SISAMcMBlir9kEA',
                                    //    author: 'lyy',
                                    //    digest: '',
                                    //    show_cover_pic: 1,
                                    //    content: "454454你好",
                                    //    content_source_url: "http://www.piaohua.com/"
                                    //  }]
                                    // console.log(media_id)
                                      var newsData = that.uploadNews().then(function (media_id) {
                                        console.log(media_id + "444444")
                                        console.log(newsData)
                                        //console.log(articles)
                                       // reportMsg = newsData;
                                      })
                            case 'News':
                                     reportMsg = msg.newsMsg (fromUser, toUser, 'ezs27f6_5PiYY5VYZNb7adXxE-FaamY1i77rCJjhcVQ')
                            break;       
                                   
                                   
                                  
                                   
                                   
                                   break;
                            default:
                                reportMsg = msg.txtMsg(fromUser,toUser,'没有这个选项哦');
                            break;
                        }
                    }
                }
                //判断消息加解密方式，如果未加密则使用明文，对明文消息进行加密
                reportMsg = req.query.encrypt_type == 'aes' ? cryptoGraphy.encryptMsg(reportMsg) : reportMsg ;
                //返回给微信服务器
                res.send(reportMsg);

            }else{
                //打印错误
                console.log(err);
            }
        });
    });
}
//nihao git
// Wechat.prototype.massSendMsg = function (req,res) {
//   var that = this
  
//   this.getAccessToken().then(function (data) {
//     var url = util.format(that.apiURL.createMenu, that.apiDomain, data)
//     that.requestPost(url, JSON.stringify(menus)).then(function (data) {
//       console.log(data)
//     })
//   })
//       var message1 = msg.massMsg('rzt')
//       console.log ('sucess')
//       res.send(message1)
      
      
  
// }
Wechat.prototype.massSendMsg = function (type) {
  var that = this;
  var msg = {
    "filter": {
      "tag_id": 2,
      "is_to_all" :true
    },
    "mpnews":{
      "media_id":"ezs27f6_5PiYY5VYZNb7afdfEUkLJ_XMZRCR8vSgNEk"
    },
    "msgtype":type,
    "send_ignore_reprint": 0
  }
  
  // msg.filter.is_to_all = true
  
  //msg[type] = message;
 return new Promise(function (resolve, reject) {
    that.getAccessToken().then(function (data) {
      var url = util.format(that.apiURL.sendAll, that.apiDomain, data)
      console.log(url)
      request({
        method: 'POST',
        url: url,
        body: msg,
        json: true
      }).then(function (response) {
        var _data = response.body;
        if (_data.errcode === 0) {
          resolve(_data);
        } else {
          throw new Error('send mass message failed: ' + _data.errcode);
          console.log('失败')
        }
      }).catch(function (err) {
        reject(err);
      });
    });
  });
}
Wechat.prototype.uploadPicture = function (urlPath, type) {
  var that = this;
  return new Promise(function (resolve, reject) {
    that.getAccessToken().then(function (data) {
      var form = { //构造表单
        media: fs.createReadStream(urlPath)
      }
      var url = util.format(that.apiURL.addPic, that.apiDomain, data, type);
      that.requestPost(url, form).then(function (result) {
        resolve(JSON.parse(result).media_id);
        // that.requestPost(url, JSON.stringify(menus)).then(function (data) {
        //   console.log(data)
        //})
      })
    })
  })
}
Wechat.prototype.uploadNews = function () {
  var that = this;
  return new Promise(function (resolve, reject) {
    
    that.getAccessToken().then(function (data) {
      var url = util.format(that.apiURL.addNews, that.apiDomain, data)
      var article = {
        method:'POST',
        url:url,
        json:true
      }
      article.body={"articles": [{
        title: "金刚zsd",
        thumb_media_id: 'ezs27f6_5PiYY5VYZNb7aariApk7SISAMcMBlir9kEA',
        author: 'lyy',
        digest: '123',
        show_cover_pic: 1,
        content: "454454你好",
        content_source_url: "http://www.piaohua.com/"
      },]}
      //acticle.body =form
      
    request(article).then(function (response) {
      var _data = response.body
      if(_data){
        resolve(_data)
        console.log(article)
        console.log("111"+_data.errcode)
        console.log(_data)
      }
      else{
        throw new Error("upload failed " + _data.errcode)
      }
    }).catch(function (err) {
      reject(err)
    })
      
    })
  })
}
// Wechat.prototype.uploadNews = function (material) {
//   var that =this
//   return new Promise(function (resolve,reject) {
//     that.getAccessToken().then(function (data) {
//       var form = material
//       console.log(form)
//       var url = util.format(that.apiURL.addNews, that.apiDomain, data)
//       // that.requestPost(url,form).then(function (result) {
//       //   resolve(JSON.parse(result).media_id)
//       // })
//       var opts = {
//         method: 'POST',
//         url: url,
//         json: true
//       }
//       opts.body = form;
//       request(opts).then(function (response) {
//         var _data = response.body;
//         if (_data) {
//           resolve(_data);
//           console.log("success "+_data.errcode)
//           console.log(_data.media_id)
//         } else {
//           throw new Error('upload permanent material failed!' + _data.errcode);
//         }
//       }).catch(function (err) {
//         reject(err);
//       })
      
//     })
    
//   })
// }


// Wechat.prototype.uploadPermMaterial = function (type, material) {
//   var that = this;
//   var form = {}
//   var uploadUrl = '';
//   if (type === 'pic') uploadUrl = api.uploadPermPics;
//   if (type === 'other') uploadUrl = api.uploadPermOther;
//   if (type === 'news') {
//     uploadUrl = that.apiURL.addNews;
//     form = material
//   } else {
//     form.media = fs.createReadStream(material);
//   }
//   return new Promise(function (resolve, reject) {
//     that.getAccessToken().then(function (data) {
//       var url = util.format(uploadUrl, that.apiDomain, data)
//       var opts = {
//           method: 'POST',
//           url: url,
//           json: true
//         }
//         (type === 'news') ? (opts.body = form) : (opts.formData = form); //上传数据的方式不同
//       request(opts).then(function (response) {
//         var _data = response.body;
//         if (_data) {
//           resolve(_data)
//         } else {
//           throw new Error('upload permanent material failed!' + _data.errcode);
//         }
//       }).catch(function (err) {
//         reject(err);
//       });
//     });
//   });
// }
Wechat.prototype.uploadPermMaterial = function (type, material) {
  var that = this;
  var form = {}
  var uploadUrl = '';
  if (type === 'pic') {
    uploadUrl = that.apiURL.addPic;
  }
  if (type === 'news') {
    uploadUrl = that.apiURL.addNews;
    form = material
  } else {
    form.media = fs.createReadStream(material);
  }
  return new Promise(function (resolve, reject) {
    that.getAccessToken().then(function (data) {
      var url = util.format(uploadUrl, that.apiDomain, data)
      var opts = {
        method: 'POST',
        url: url,
        json: true
      }
      if (type === 'news') {
        opts.body = form;
      } else {
        opts.formData = form;
      }
      console.log(opts.body)
      console.log(form)
      request(opts).then(function (response) {
        var _data = response.body;
        if (_data) {
          resolve(_data);
          console.log("success")
        } else {
          throw new Error('upload permanent material failed!'+_data.errcode);
        }
      }).catch(function (err) {
        reject(err);
      });
    });
  });
}

module.exports = Wechat