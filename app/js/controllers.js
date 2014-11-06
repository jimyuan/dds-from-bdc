(function(){
  'use strict';
  var templatePath = 'views/';
  var app = angular.module('DdsControllers', [])
   /* 全局controller，不包括登录页面 */
  .controller('GlobelController', ['$rootScope', '$scope', '$location', 'C', 'DDS', 'AuthService', function($rootScope, $scope, $location, C, DDS, AuthService){
    var storage = C.storage();
    var isLogged = AuthService.isLogged || storage.get('isLogged');
    /*rootscope setting*/
    angular.extend($rootScope, {
      version: 'ver 0.3',
      showPage:isLogged,
      dateOptions: {
        showWeeks:false,
        startingDay:1
      },
      toggleCal: function(event){
        event.preventDefault();
        event.stopPropagation();
      },
      menus:storage.get('menus'),
      userId:storage.get('userId'),
      isActivedMenu: function(viewLocation){
        return viewLocation === $location.path();
      },
      markOpen: function(no){
        storage.set('opendAccordion', no);
      },
      keepOpenAccordion: function(){
        var index = storage.get('opendAccordion');
        if(index !== null){
          this.menus[index].open = true;
        }
      }
    });
    $rootScope.keepOpenAccordion();

    angular.extend($scope, {
      alerts: [],
      pageNum:1,
      maxPageSize : 8,
      recordsPerPage: 2,
      menuTemplate: templatePath + 'menu.html',
      closeAlert: function(index){
        this.alerts.splice(index, 1);
      },
      signOut: function(){
        DDS.signOut(function(res){
          var data = C.validResponse(res);
          if(typeof data !== 'string' && data.code === 0){
            AuthService.isLogged = false;
            storage.clear();
            $rootScope.menus=[];
            $rootScope.showPage=AuthService.isLogged;
            C.back2Login();
          }
        });
      }
    });
  }])
  /* 登陆页面 */
  .controller('AdminController', ['$rootScope', '$filter', '$scope', '$location','$timeout', 'C', 'DDS', 'AuthService', function($rootScope, $filter, $scope, $location, $timeout, C, DDS, AuthService){
    var storage = C.storage();
    if(storage.get('isLogged')){
      $location.path('/home');
    }
    else{
      storage.clear();
      $rootScope.menus=[];
    }

    $scope.checkLogin = function(){
      /*login success:
          1. sessionStorage: token & userId & loginInfo
          2. authService.isLogin value is true
          3. sessionStorage: menu,role,province
      */
      $scope.user.password = $filter('md5')($scope.user.password);
      $scope.master = angular.copy($scope.user);
      DDS.login($scope.user, function(res){
        var data = C.validResponse(res);
        if(typeof data!=='string'){
          AuthService.isLogged = true;
          storage.set('isLogged', true);
          
          //缓存登录信息
          storage.set('token', data.sessionId);
          storage.set('userId', data.user.userId);
          storage.set('loginInfo', data.user);

          //缓存
          DDS.get({endpoint:'menu', action:'select', type:2, userId:data.user.userId}, function(result){
            storage.set('menus', result.data);
            $scope.hideLogin=true;
            $timeout(function(){
              $location.path('/home');
              $rootScope.showPage=AuthService.isLogged;
            }, 500)
          });
        }
        else{
          C.alert($scope, {type:'danger', msg:data});
        }
      }, function(){
        C.alert($scope, {type:'danger', msg:'network error!'});
      });
    };

    $scope.isUnchanged = function(user){
      return angular.equals(user, $scope.master);
    };
  }])
  /* 修改密码 */
  .controller('ChangePasswordController', ['$scope', 'C' ,'DDS', '$filter', 'AuthService', function($scope, C, DDS, $filter, AuthService){
    var storage = C.storage().get('loginInfo');
    $scope.pwd = {};
    $scope.pwdSubmit = function(){

      var postData = {    
        userId: storage.userId,
        sessionId : storage.sessionId,
        id: storage.id,
        oldPassword: $filter('md5')($scope.pwd.oldPwd),
        newPassword: $filter('md5')($scope.pwd.newPwd)
      };
      $scope.master = angular.copy($scope.pwd);
      DDS.savePwd(postData, function(res){
        var data = C.validResponse(res);
        if(typeof data!=='string'){
          C.alert($scope, {type:"success", msg:"密码修改成功!"});
          C.back2Home(true);
        }
        else{
          C.alert($scope, {type:"danger", msg:data});
        }
      });
    };
    $scope.isUnchanged = function(pwd){
      return (angular.equals(pwd, $scope.master) || pwd.newPwd !== pwd.rpNewPwd);
    };
  }])
  /* 欢 迎 页 */
  .controller('HomeController', ['$rootScope', '$scope', 'C' ,'DDS', '$location', 'AuthService', function($rootScope, $scope, C, DDS, $location, AuthService){
    var storage = C.storage();
    // 从localstorage获取菜单数据
    if(storage.get("loginInfo")){
      angular.extend($rootScope, {
        menus: storage.get('menus'),
        userId:storage.get('userId')
      });
    }
    //缓存角色与省市数据
    C.cacheData(DDS, {endpoint:'role', action:'select'});
    C.cacheData(DDS, {endpoint:'provinces', action:'select'});
  }])
  /* 用户管理 */
  .controller('UserController', ['$scope','DDS', 'C', function($scope, DDS, C){
    var storage = C.storage(), userInfo;
    var paramsInit = {
      endpoint:'user', action:'select',
      pageNum:$scope.pageNum
    };
    $scope.changePage = function(){
      C.list(this, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage(); // default: load pageNum:1
    /* 搜索 */
    $scope.doSearch = function(o){
      if(o){
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum:1}));
      }
    };

    $scope.saveUser = function(user){
      var params={pageNum:$scope.pageNum};
      if(user){
        userInfo = angular.extend({},user);
        angular.extend(params, {action:'edit', id:userInfo.id});
      }
      else{
        angular.extend(params, {action:'add'});
        userInfo = {};
      }
      var modalSet = {
        modalTitle: '用户信息', // modal 窗体标题
        extraData: {roles:storage.get('role').roles, editMode:params.action==='edit'},
        formData: userInfo || {},
        confirm: function(modalInstance, scope){ // 确认modal callback
          delete scope.formData.role;
          DDS.saveUser(angular.extend(params, scope.formData), function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet, 'user');
    };
    $scope.remove = function(id){
      var modalSet = {
        removeText: '确定要删除这条用户记录？', // modal 删除提示语
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.delUser({pageNum:$scope.pageNum, id: id}, function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet);
    };
  }])
  /* 角色管理 */
  .controller('RoleController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var paramsInit = {
      endpoint:'role', action:'select',
      pageNum:$scope.pageNum
    };
    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage(); // default: load pageNum:1

    $scope.doSearch = function(o){
      if(o){
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
      }
    };

    $scope.saveRole = function(role){
      DDS.get({endpoint:'menu', action:'select', type:'1'}, function(res){
        var data = C.validResponse(res), roleInfo;
        if(typeof data!=='string'){
          var flatMenu=[];
          for(var m in data){
            flatMenu.push({
              id:data[m].id,
              name:'' + data[m].name
            });
            for(var sm in data[m].subname){
              flatMenu.push({
                id: data[m].subname[sm].id,
                name:'　---' + data[m].subname[sm].name
              });
            }
          }
          var params={pageNum:$scope.pageNum};
          if(role){
            roleInfo = angular.extend({}, role);
            angular.extend(params, {action:'edit', id:roleInfo.id});
          }
          else{
            angular.extend(params, {action:'add'});
          }
          var modalSet = {
            modalTitle: '角色定义', // modal 窗体标题
            formData: roleInfo || {},
            extraData:flatMenu,
            confirm: function(modalInstance, scope){ // 确认modal callback
              delete scope.formData.permitList;
              DDS.saveRole(angular.extend(params, scope.formData), function(res){
                C.responseHandler(scope, $scope, modalInstance, res);
              });
            }
            // ,cancel: C.cancelModal
          };
          C.openModal(modalSet, 'role');
        }
      });
    };

    $scope.remove = function(id){
      var modalSet = {
        removeText: '确定要删除这个角色？', // modal 删除提示语
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.delRole({pageNum:$scope.pageNum, id: id}, function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet);
    };  
  }])
  /* 客户管理 */
  .controller('CustomerController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var paramsInit = {
      endpoint:'customer', action:'select',
      pageNum:$scope.pageNum
    };
    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage(); // default: load pageNum:1

    $scope.saveCust = function(cust){
      var params={pageNum:$scope.pageNum}, custInfo;
      if(cust){
        custInfo = angular.extend({},cust);
        angular.extend(params, {action:'edit', id:custInfo.id});
      }
      else{
        angular.extend(params, {action:'add'});
        custInfo = {};
      }
      var modalSet = {
        modalTitle: '客户信息', // modal 窗体标题
        formData: custInfo || {},
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.saveCust(angular.extend(params, scope.formData), function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet, 'cust');
    };

    $scope.doSearch = function(o){
      if(o){
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
      }
    };
  }])
  /* 司机管理 */
  .controller('DriverController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var paramsInit = {
      endpoint:'driver', action:'select',
      pageNum:$scope.pageNum,
    };

    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage(); // default: load pageNum:1

    $scope.saveDriver = function(driv){
      var params={pageNum:$scope.pageNum}, drivInfo;
      if(driv){
        drivInfo = angular.extend({},driv);
        angular.extend(params, {action:'edit', id:drivInfo.id});
      }
      else{
        angular.extend(params, {action:'add'});
        drivInfo = {};
      }
      var modalSet = {
        modalTitle: '司机信息', // modal 窗体标题
        formData: drivInfo || {},
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.saveDriv(angular.extend(params, scope.formData), function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet, 'driv');
    };

    $scope.remove = function(id){
      var modalSet = {
        removeText: '确定要删除这个司机的信息？', // modal 删除提示语
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.delDriv({pageNum:$scope.pageNum, id: id}, function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
        // ,cancel: C.cancelModal
      };
      C.openModal(modalSet);
    }; 

    $scope.doSearch = function(o){
      if(o){
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
      }
    };
  }])
  /* 订单管理 */
  .controller('OrderController', ['$scope', 'DDS', 'C', '$timeout', '$routeParams', function($scope, DDS, C, $timeout, $routeParams){
    var paramsInit = {
      endpoint:'order', action:'select',
      pageNum:$scope.pageNum
    };
    angular.extend(paramsInit, $routeParams);
    angular.extend($scope, {
      syncStatus: '同步订单',
      sync:{
        primary:true,
        success:false,
        danger:false
      },
      search:{},
      changePage: function(){
        C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
      },
      doSearch: function(o){
        if(o){
          C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
        }
      },
      // 订单同步
      syncOrder: function(orderId){
        var self = this, syncParams;
        if(!self.sync.success){
          self.syncStatus = '正在同步';
          syncParams = angular.extend({
            endpoint:'order', action:'synchOrder', 
            orderId: orderId, chaos: Math.random()
          });
          DDS.get(syncParams, function(res){
            var data = C.validResponse(res);
            $timeout(function(){
              if(typeof data!=='string'){
                self.sync = {
                  primary:false,
                  success:true,
                  danger:false
                };
                self.syncStatus = data.message;
              }
              else{
                self.syncStatus = '同步失败';
                self.sync = {
                  primary:false,
                  success:false,
                  danger:true
                };
              }
            }, 2000);
          });
          
        }
      },
      orderExport: function(){
        C.exportFile($scope, DDS, angular.extend({endpoint:'order', action:'exportOrder'}, $scope.search));
      }
    });
    $scope.changePage();
  }])
  /* 时间段统计 */
  .controller('OrderFilterController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var curYear = new Date().getFullYear(), curMonth = new Date().getMonth();
    $scope.years = C.range(2010, curYear);
    $scope.search = {
      year: curYear,
      month: curMonth + 1,
      quarter: Math.ceil((new Date().getMonth()+1)/3),
      dp1: curYear + '-' + C.twiNum(curMonth+1) + '-01',
      dp2: curYear + '-' + C.twiNum(curMonth+1) + '-' + C.mLength()[curMonth]
    };
    $scope.areas = C.storage().get('provinces');

    var paramsInit = angular.extend({endpoint:'order', action:'statis'}, C.getPeriod($scope.search));
    
    $scope.staticsExport = function(){
      C.exportFile($scope, DDS, angular.extend(
        {endpoint:'order', action:'exportStatis'}, 
        C.getPeriod($scope.search),
        $scope.search
      ));
    };

    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage();

    $scope.doSearch = function(o){
      var s = angular.extend(paramsInit, o, C.getPeriod(o), {pageNum:1});
      delete s.dp1; 
      delete s.dp2;
      C.list($scope, DDS, s);
    };

    $scope.orderByCust = function(cName){
      C.goOrderList(cName);
    };
  }])
  /* 计费规则模板 */
  .controller('RuleTemplateController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var paramsInit = {
      endpoint:'template', action:'select',
      pageNum:$scope.pageNum
    };
    $scope.search = {};
    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage();

    $scope.doSearch = function(o){
      if(o){
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
      }
    };

    $scope.saveRuleTemp = function(ruleTemp){
      var params={pageNum:$scope.pageNum}, tempInfo={}, extraData={};
      if(ruleTemp){
        tempInfo = angular.extend({}, ruleTemp);
        angular.extend(params, {action:'edit', id:tempInfo.id});
        
        tempInfo.arrayStr = C.ruleStr2Json(ruleTemp.arrayStr);
        extraData.rules = C.range(0, ruleTemp.arrayStr.split(';').length-1);
        tempInfo.openTime = C.formatDate(tempInfo.openTime);
        tempInfo.closeTime = C.formatDate(tempInfo.closeTime);
      }
      else{
        angular.extend(params, {action:'add'});
        tempInfo.arrayStr = {'0':{}};
        extraData.rules = [0];
      }
      var modalSet = {
        modalTitle: '计费模板定义', // modal 窗体标题
        formData: tempInfo || {},
        extraData:extraData,
        confirm: function(modalInstance, scope){ // 确认modal callback
          var str = C.json2RuleStr(scope.formData.arrayStr);
          DDS.saveRuleTemp(angular.extend(params, scope.formData, {arrayStr:str}), function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
      };
      C.openModal(modalSet, 'temp');
    };

    $scope.remove = function(id){
      var modalSet = {
        removeText: '确定要删除这个计费模板？', // modal 删除提示语
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.delRuleTemp({pageNum:$scope.pageNum, id: id}, function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
      };
      C.openModal(modalSet);
    };

  }])
  /* 计费模板明细 */
  .controller('RuleTemplateDetailController', ['$scope', '$routeParams', 'DDS', 'C', function($scope, $routeParams, DDS, C){
    C.list($scope, DDS, {
      endpoint:'template', action:'detail',
      id:$routeParams.id
    });
    $scope.goBack = function(){
      history.back();
    }
  }])
  /* 计费规则 */
  .controller('RuleController', ['$scope', 'DDS', 'C', function($scope, DDS, C){
    var paramsInit = {
      endpoint:'rule', action:'select',
      pageNum:$scope.pageNum
    };
    $scope.search = {};
    var storage = C.storage(), extraData = {areas: storage.get('provinces')};
    $scope.changePage = function(){
      C.list($scope, DDS, angular.extend(paramsInit, {pageNum:$scope.pageNum}));
    };
    $scope.changePage();

    $scope.doSearch = function(o){
      if(o){
        if(!o.provinceId && o.cityId){
          delete o.cityId;
        }
        C.list($scope, DDS, angular.extend(paramsInit, o, {pageNum: 1}));
      }
    };

    $scope.areas = C.storage().get('provinces');

    $scope.saveRule = function(rule){
      DDS.get({endpoint: 'template', action: 'select', status: '0'}).$promise.then(function(result){
          var data = C.validResponse(result);
          if(typeof data !== 'string'){
            var templates=data.templates;
            var params={pageNum:$scope.pageNum}, ruleInfo;
            for(var i=0; i<templates.length; i++){
              templates[i].rules = C.range(0, templates[i].arrayStr.split(';').length-1);
              angular.extend(templates[i], {arrayStr:C.ruleStr2Json(templates[i].arrayStr)})
            }
            if(rule){
              ruleInfo = angular.extend({}, rule);
              ruleInfo.openTime = C.formatDate(ruleInfo.openTime);
              ruleInfo.closeTime = C.formatDate(ruleInfo.closeTime);
              angular.extend(params, {action:'edit', id:ruleInfo.ruleId});
              angular.extend(
                extraData, 
                {showEdit:true, showAreaSel:false}
              );
            }
            else{
              angular.extend(params, {action:'add'});
              angular.extend(extraData, {showEdit:false, showAreaSel:true});
            }
            var modalSet = {
              modalTitle: '计费规则定义', // modal 窗体标题
              formData: ruleInfo || {},
              extraData: angular.extend(extraData,{templates: templates}),
              confirm: function(modalInstance, scope){ // 确认modal callback
                var str = C.json2RuleStr(scope.formData.arrayStr);
                DDS.saveRule(angular.extend(params, scope.formData, {arrayStr:str}), function(res){
                  C.responseHandler(scope, $scope, modalInstance, res);
                });
              }
            };
            C.openModal(modalSet, 'rule');
          }
      });
    };

    $scope.remove = function(id){
      var modalSet = {
        removeText: '确定要删除这条计费规则？', // modal 删除提示语
        confirm: function(modalInstance, scope){ // 确认modal callback
          DDS.delRule({pageNum:$scope.pageNum, id: id}, function(res){
            C.responseHandler(scope, $scope, modalInstance, res);
          });
        }
      };
      C.openModal(modalSet);
    };
  }])
  /* 规则明细 */
  .controller('RuleDetailController', ['$scope', '$routeParams', 'DDS', 'C',function($scope, $routeParams, DDS, C){
    C.list($scope, DDS, {
      endpoint:'rule', action:'detail',
      id:$routeParams.id
    });
    $scope.goBack = function(){
      history.back();
    }
  }])
  /* demo */
  .controller('DemoController', ['$scope', '$modal', 'C', function($scope, $modal, C){
    angular.extend($scope, {
      maxSize : 10,
      totleRecords : 200,
      currentPage : 2,
      recordsPerPage: 20,
      changePage: function(){
      },
      modify: function(){
        var modalSet = {
          modalTitle: '名称', // modal 窗体标题
          confirm: function(modalInstance, scope){ // 确认modal callback
            console.log(scope.formData); // collect form data
            modalInstance.close(function(){ // close modal
              C.alert($scope, {type:'success', msg:'编辑成功！'});
            });
          },
          cancel: C.cancelModal
        };
        C.openModal(modalSet, 'general.modify');
      },
      remove: function(){
        var modalSet = {
          removeText: '确定要删除这条记录？', // modal 删除提示语
          confirm: function(modalInstance){ // 确认modal callback
            modalInstance.close(function(){
              // $log.info('remove');
              C.alert($scope, {type:'danger', msg:'OK!'});
            });
          },
          cancel: function(modalInstance){ // 取消modal 默认没有callback
            modalInstance.dismiss('dismiss');
          }
        }; 
        C.openModal(modalSet);
      }
    });
  }])
  /* normal modal */
  .controller('ModalController', ['$scope', '$modalInstance', 'modalSet', function($scope, $modalInstance, modalSet){
    angular.extend($scope, {
      alert:{show:false},
      modalTitle: modalSet.modalTitle,
      formData:modalSet.formData || {},
      extraData: modalSet.extraData || {},
      removeText: modalSet.removeText,
      confirm: function(){
        modalSet.confirm($modalInstance, this);
      },
      cancel: function(){
        // modalSet.cancel($modalInstance);
        $modalInstance.dismiss('cancel');
      },
      selCity:function(){
        modalSet.selCity(this);
      }
    });
  }]);
})();