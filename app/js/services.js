(function(){
  'use strict';
  var app = angular.module('DdsServices', [])
  .factory('DDS', ['$resource', function($resource){
    var normalPrarms = {local:1, mock:1, enforce:1};
    // var url = 'http://10.10.40.219:8080/ddrive-platform-web/:endpoint/:action/:id';
    var url = 'http://127.0.0.1:8084/:endpoint/:action/:id'
    // normalPrarms = {};
    return $resource(url, normalPrarms, {
      login:{
        method:'GET',
        params:{endpoint:'user', action:'login'}
      },
      signOut:{
        method:'POST',
        params:{endpoint:'user', action:'signOut'}
      },
      savePwd:{
        method:'POST',
        params:{endpoint:'user', action:'editPassword'}
      },
      delUser:{
        method:'POST',
        params:{endpoint:'user', action:'delete', id:'@id'}
      },
      saveUser:{
        method:'POST',
        params:{endpoint:'user', action:'@action', id:'@id'}
      },
      delRole:{
        method:'POST',
        params:{endpoint:'role', action:'delete', id:'@id'}
      },
      saveRole:{
        method:'POST',
        params:{endpoint:'role', action:'@action', id:'@id'}
      },
      saveRule:{
        method:'POST',
        params:{endpoint:'rule', action:'@action', id:'@id'}
      },
      delRule:{
        method:'POST',
        params:{endpoint:'rule', action:'delete', id:'@id'}
      }
    });
  }])
  .factory('C', ['$window', '$timeout','$location', '$modal','localStorageService', function($window, $timeout, $location, $modal, ls){
    return {
      runtimeEvn: function(){
        //0开发 1测试 2生产 3其他
        var ua = navigator.userAgent.toLowerCase();
        var host = $window.location.host,
            path = $window.location.pathname,
            local= /^(localhost|10\.10|127\.0|192\.168)/i;
        if(window.DEBUG){
          return 0;
        }
        if(local.test(host) && /^\/d.html/.test(path)) {
          return 0;
        }
        else if(local.test(host) && (/^\//.test(path) || /^\/index.html/.test(path))){
          return 1;
        }
        else if(/github.io$/.test(host)){
          return 2;
        }
        else {
          return 3;
        }
      },

      succ: function(chart){
        if (angular.isNumber(chart)) { return chart - 0 + 1; }
        else {
          chart = chart + "";
          return chart.slice(0, chart.length - 1) +
          String.fromCharCode(chart.charCodeAt(chart.length - 1) + 1);
        }
      },

      range: function(start, end){
        var edge = arguments[2] || false;
        var v = start;
        var a = [];
        var flag = function (value) {
          if (value < start) { return false; }
          if (edge) { return value < end; }
          return value <= end;
        };
        while (flag(v)) {
          a.push(v); v = this.succ(v);
        }
        return a;
      },

      alert: function(scope, opts, alone){
        if(alone){
          angular.extend(scope.alert, opts);
        }
        else{
          scope.alerts.push(opts);
          $timeout(function(){ 
            scope.alerts.pop();
          }, 3000);
        }
      },
      validResponse: function(res){
        if(res.header){
          if(res.header.errorCode === 0){
            if(res.data.code>0){
              return res.data.message;
            }
            else{
              return res.data;
            }
          }
          else{
            return 'errorCode = ' + res.header.errorCode
          }
        }
        else{
          return '系统错误，无返回数据！';
        }
      },

      openModal: function(modalSet, module){
        var m = module || 'general.remove';
        var options = {
          templateUrl: 'views/modal.'+ m +'.html',
          controller: 'ModalController',
          resolve: {
            modalSet: function(){ return modalSet }
          }
        };
        if(m  === 'general.remove'){
          angular.extend(options, {size:'sm'});
        }
        var modalInstance = $modal.open(options);

        modalInstance.result.then(
          function (result) {
            result();
          }, 
          function (reason) {
            // console.log(reason);
          }
        );
        modalInstance.opened.then(
          function(info){}
        );
      },

      cancelModal: function(modalInstance){ // 取消modal 默认没有callback
        modalInstance.dismiss('dismiss');
      },
      storage: function(){
        var store, now = new Date();
        ls.isSupported ? store = ls : store = ls.cookie;
        return {
          set: function(key, val){
            return ls.set(key, val);
          },
          get: function(key){
            return ls.get(key);
          },
          remove: function(key){
            return ls.remove(key);
          },
          clear: function(){
            return ls.clearAll();
          }
        }
      },

      back2Login:function(){
        $window.location='login.html';
      },

      back2Home: function(delay){
        if(delay){
          $timeout(function(){
            $location.path('/home');
          }, 3000);
        }
        else{
          $location.path('/home');
        }
      },

      list:function(scope, resource, options){
        var self = this;
        resource.get(options, function(res){
          var data = self.validResponse(res);
          if(typeof data!=='string'){
            angular.extend(scope, data);
            scope.showPagination = true;
          }
        });
      },

      responseHandler: function(modalScope, ctrlScope, modalInstance, res){
        var self = this, data = self.validResponse(res);
        if(typeof data!=='string'){
          modalInstance.close(function(){ // close modal
            angular.extend(ctrlScope, data);
            self.alert(ctrlScope, {type:'success', msg:data.message || '操作成功！'});
          });
        }
        else{
          self.alert(modalScope, {msg:data, show:true}, true);
        }
      },

      cacheData: function(resource, params){
        var self = this, key = params.endpoint;
        var storage = self.storage();
        var storeData = function(){
          resource.get(params, function(res){
            var data = self.validResponse(res);
            if(typeof data!=='string'){
              storage.set(key, data);
              console.log('data cache success!');
            }
            else{
              return false;
              console.log('data cache error!');
            }
          });
        };
        if(!storage.get(key)){
          $timeout(storeData, 200);
        }
      }
    };
  }]);
})();