/* global VBET5 */
/**
 * @ngdoc controller
 * @name vbet5.controller:mainHeaderCtrl
 * @description
 * Main header controller
 */
VBET5.controller('mainHeaderCtrl', ['$rootScope', '$scope', '$interval', '$filter', '$route', '$q', '$window', '$location', '$document', '$http', '$cookies', 'Geoip', 'CountryCodes', 'Config', 'ConnectionService', 'Zergling', 'Storage', 'DomHelper', 'Utils', 'smoothScroll', 'Translator', 'analytics', 'AuthData', 'Script', 'liveChat', 'GameInfo', 'partner', 'TopMenu', 'TimezoneService', 'Moment', 'content', 'UserAgent', '$timeout', 'RegConfig', 'RoutesValidity',
  function ($rootScope, $scope, $interval, $filter, $route, $q, $window, $location, $document, $http, $cookies, Geoip, CountryCodes, Config, ConnectionService, Zergling, Storage, DomHelper, Utils, smoothScroll, Translator, analytics, AuthData, Script, liveChat, GameInfo, partner, TopMenu, TimezoneService, Moment, content, UserAgent, $timeout, RegConfig, RoutesValidity) {
    'use strict';
    var connectionService = new ConnectionService($scope);
    var appHasBeenUpdated = false;
    $scope.env.showSignInForm = false;
    $scope.env.showRegistrationForm = false;
    $scope.timezonesExpanded = false;
    $scope.isCssLoading = false;
    $rootScope.timezoneIsAvailable = $q.defer();
    $rootScope.env.appVersion = Config.releaseDate;
    if (Config.env.selectedTimeZone) {
      $rootScope.timezoneIsAvailable.resolve(Config.env.selectedTimeZone);
    } else {
      var timeZonePromise = $rootScope.$watch('env.selectedTimeZone', function () {
        if ($rootScope.env.selectedTimeZone) {
          timeZonePromise();
          $rootScope.timezoneIsAvailable.resolve(Config.env.selectedTimeZone);
        }
      });
    }

    var pathTypes = {
      'casino': ['/casino', '/games', '/poker', '/game', '/livedealer', '/keno', '/fantasy', '/ogwil', '/jackpot', '/financials', '/backgammon', '/belote', '/pokerklas', '/poker', '/ggpoker', '/gameslanding', '/vrcasino', '/csbpoolbetting', '/tournaments', '/go', '/blast','/jackpots'],
      'sport': ['/sport', '/freebet', '/poolbetting', '/livecalendar', '/results', '/virtualsports', '/overview', '/multiview', '/dashboard', '/exchange', '/statistics', '/customsport', '/esports']
    };
    pathTypes[Config.main.homepagePageType].push('/');

    $rootScope.currentPage = {};
    $rootScope.casinoPaths = pathTypes.casino;

    if (Config.main.header.acceptCookies) {
      $scope.cookiesNotification = {
        cookiesAccepted: !!Storage.get('cookiesAccepted')
      };

      $scope.cookiesNotification.cookiesText = Translator.get('By using this website, you accept the placement and use of cookies. For more information please read our {1}', [
        '<a href="#?help=privacy-policy&amp;lang=' + Config.env.lang + '" target="_blank">' + Translator.get('Privacy Policy') + '</a>',
        '<a href="#?help=general-terms-and-conditions&amp;lang=' + Config.env.lang + '" target="_blank">' + Translator.get('Terms &amp; Conditions') + '</a>',
        Config.main.registration.minimumAllowedAge || ''
      ]);

      $scope.acceptCookies = function acceptCookies() {
        $scope.cookiesNotification.cookiesAccepted = true;
        Storage.set('cookiesAccepted', true);
      };
    }


    Utils.setBodyClass(Config.main.bodyWrapperClass, 'body');

    Config.env.sliderAsPopup = { 'register': Config.main.registration.simplified, 'login': Config.main.registration.simplified, 'forgotPasswordForm': Config.main.registration.simplified, 'idToken': true}; //show popup instead of slider

    /**
     * @ngdoc object
     * @name setCurrentPath
     * @description sets current path in rootScope
     */
    function setCurrentPath() {
      if(Config.main.customSportsBook[Config.main.sportsLayout] && $location.search().type){
        if(Config.main.customSportsBook[Config.main.sportsLayout] && Config.main.customSportsBook[Config.main.sportsLayout].showPrematch === false){
          $location.search().type = 1;
        }
        if(Config.main.customSportsBook[Config.main.sportsLayout] && Config.main.customSportsBook[Config.main.sportsLayout].showLive === false){
          $location.search().type = 0;
        }
      }
      var previousPath  = $rootScope.currentPage.path;
      $rootScope.currentPage.path = $location.path().split("/").slice(0, 2).join("/");
      if (previousPath !== undefined && previousPath !== $rootScope.currentPage.path) {
        $rootScope.env.showSlider = false;
        $rootScope.env.sliderContent = '';
      }
      $rootScope.currentPage.params = $location.search();
      $rootScope.currentPage.isInCasino = !$rootScope.calculatedConfigs.sportEnabled || pathTypes.casino.indexOf($rootScope.currentPage.path) !== -1;
      $rootScope.currentPage.isInSports = pathTypes.sport.indexOf($rootScope.currentPage.path) !== -1;
      $rootScope.currentPage.hasSubHeader = ($scope.subMenuItems && $scope.subMenuItems.length > 0) || (Config.main.enableSubHeader && Config.main.subHeaderItems.length && $rootScope.currentPage.isInSports && !{'/':1, '/poolbetting':1, '/virtualsports':1}[$rootScope.currentPage.path]);

    }
    setCurrentPath();

    /**
     * @ngdoc object
     * @name setCurrentPath
     * @description sets account message if mail set
     */
    function setAccountVerificationMessage () {
      if (Config.main.accountVerificationEmail) {
        Config.main.accountVerificationMessage = Translator.get('In order to verify your details, please send a copy of the document you registered with. If you did not register any document, please send a copy of either your Passport or ID Card.<br/>We will also require a copy of a document verifying your registered address (a utility bill or similar) in your name.<br/><br/>Once you have these files, please send them, from your registered email address to {1} along with your Customer ID and with "Scan for Verification" as the subject.', ['<a href="mailto:' + Config.main.accountVerificationEmail + '">' + Config.main.accountVerificationEmail + '</a>']);
      }
    }
    setAccountVerificationMessage();

    function checkActions() {
      var action = $location.search().action;
      if (action && action !== 'verify') {
        if (!$rootScope.env.authorized && needLogin2Continue()) {
          if ($rootScope.loginInProgress) {
            var loginProcessWatcher = $scope.$watch('loginInProgress', function(value) {
              if (!value) {
                loginProcessWatcher();
                $scope.toggleSliderTab(action, '', true);
              }
            });
          } else {
            openSigninForm({data: action, key: 'toggleSliderTab'});
          }
        } else {
          $scope.toggleSliderTab(action, '', true);
        }
        $location.search('action', undefined);
      }
    }

    $scope.processLocationChange = function processLocationChange() {
      setCurrentPath();
      checkActions();

      if ({'/casino/':1, '/livedealer/':1, '/games/':1}[$location.path()]) {
        if (!$location.search().game && $rootScope.casinoGameOpened === 1) {
          $rootScope.$broadcast('casino.action', {action: 'closeGame'});
        }
      }
    };

    if (Config.main.favoriteTeam && Config.main.favoriteTeam.deleteFavoritesOnReload) {
      Storage.remove('myGames');
    }

    if (!Config.main.menuCountryFilter) {
      TopMenu.init($scope); //pass current scope to TomMenu service
    }

    $rootScope.geoDataAvailable =  $rootScope.geoDataAvailable || Geoip.getGeoData(false);

    /**
     * @ngdoc object
     * @name geoDataAvailable
     * @description Gets country info based on user IP
     */
    $rootScope.geoDataAvailable.then(
        function (data) {
          $rootScope.geoCountryInfo = data;
          var notAllowed = Config.main.registration.allowedCountriesByIp && Config.main.registration.allowedCountriesByIp.indexOf(data.countryCode) === -1;
          var restricted = Config.main.registration.restrictedCountriesByIp && Config.main.registration.restrictedCountriesByIp.indexOf(data.countryCode) !== -1;
          if (notAllowed || restricted) {
            if (Config.main.registration.restrictedCountriesLoginAndRegistration) {
              //disable register and login for specific countries by ip
              Config.main.header.disableRegistrationAndLogin = true;
              Config.main.registration.enableSignIn = false;
              Config.main.registration.enable = false;
            }else {
              Config.main.registration.registrationBlocked = true;
            }
          }
        },
        function () {
          $rootScope.geoCountryInfo = false;
        }
    )['finally'](function () {
      if (Config.main.menuCountryFilter) {
        TopMenu.init($scope, $rootScope.geoCountryInfo && $rootScope.geoCountryInfo.countryCode);
      }
    });

    $rootScope.casinoEnabled = $rootScope.calculatedConfigs.casinoEnabled || $rootScope.calculatedConfigs.livedealerEnabled || $rootScope.calculatedConfigs.skillgamesEnabled || $rootScope.calculatedConfigs.financialsEnabled || $rootScope.calculatedConfigs.fantasyEnabled;

    /**
     * @ngdoc object
     * @name balanceSlider
     * @propertyOf vbet5.controller:mainHeaderCtrl
     * @description toggles balance slider
     */
    $scope.balanceSlider = {
      status: true,
      toggle: function () {
        if (this.status === false) {
          $scope.closeSlider();
        } else {
          $scope.openBalancePage();
          this.status = false;
        }
      }
    };

    var connectionLost = false;

    $scope.$watch('[myGames.length, myCasinoGames.length]', function () {
      if ($scope.myGames && $scope.myCasinoGames) {
        partner.call('favoriteGamesCount', $scope.myGames.length + $scope.myCasinoGames.length);
      }
      $scope.favGamesChange = true;
      $timeout(function () { $scope.favGamesChange = false; }, 350);
    }, true);

    /**
     * @ngdoc method
     * @name detectAppVersion
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description checks the app version and set appHasBeenUpdated = true browser will be updated afterwards
     */
    function detectAppVersion() {
      $http({
        method: 'GET',
        url: 'appVersion.json?anticache=' + Math.floor(Math.random() * 1000)
      }).then(function(data) {
        if (data.data && data.data.appVersion) {
          if ($rootScope.env.appVersion && $rootScope.env.appVersion !== Config.releaseDate && $rootScope.env.appVersion !== data.data.appVersion) {
            appHasBeenUpdated = true;
          }
          $rootScope.env.appVersion = data.data.appVersion;
        }

      });
    }

    function notifyNotAvailable() {  // when logging in and registering to notify when the Client is unavailable these actions
      $rootScope.$broadcast("globalDialogs.addDialog", {
        type: "warning",
        title: "Warning",
        content: "Dear Customer, We kindly inform that the website is not available for the IP address and/or territorial area from which you are trying to connect."
      });
    }



    // getAppVersion initialization
    $interval(detectAppVersion, 1800000); // 30 minutes
    $timeout(detectAppVersion, 60000); // 1 minute

    /**
     * @ngdoc method
     * @name toggleSliderTab
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description toggles slider and switches to specified "tab"
     *
     * @param {string} name block name to switch to
     * @param {string?} subMenu
     * @param {boolean?} dontClose optional. if true, tab will not be closed if it's open
     * @returns {boolean} block state if after toggling (true: visible, false: hidden)
     */
    $scope.toggleSliderTab = function toggleSliderTab(name, subMenu, dontClose) {
      if ($scope.env.sliderContent === name && $scope.env.showSlider && !dontClose) {
        $scope.env.showSlider = false;
        $scope.env.sliderContent = '';
        return false;
      } else {
        switch (name) {
          case 'register':
            if (!Config.main.registration.enable) {
              notifyNotAvailable();
              return;
            }
            break;
          case 'login':
            if (!Config.main.registration.enableSignIn) {
              notifyNotAvailable();
              return;
            }
            break;
          case 'settings':
            if (subMenu && $scope.env.mixedSettingsPage !== subMenu) {
              $scope.env.mixedSettingsPage = subMenu;
            }
            break;
        }
        $scope.env.showSlider = true;
        $scope.env.sliderContent = name;
        analytics.gaSend('send', 'event', 'slider', 'open slider',  {'page': $location.path(), 'eventLabel': name});
        return true;
      }
    };

    $scope.$on('toggleSliderTab', function (event, data) {
      if (angular.isObject(data)) {
        $scope.toggleSliderTab(data.tab, data.subMenu);
      } else {
        $scope.toggleSliderTab(data);
      }
    });

    /**
     * @ngdoc method
     * @name openSigninForm
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows the sign-in block
     *
     */
    function openSigninForm(action) {
      if (!Config.main.registration.enableSignIn || $scope.openCustomDialog('loginiframe')) {
        notifyNotAvailable();
        return;
      }

      if (!Config.main.integrationMode) {
        $scope.env.showSlider = true;
        $scope.env.sliderContent = 'login';
        if (action) {
          var sliderWatcherPromise = $scope.$watch('env.showSlider', function (newValue, oldValue) {
            if (!newValue && oldValue) {
              sliderWatcherPromise();
              $scope.env.authorized && $rootScope.$broadcast(action.key, action.data);
            }
          });
        }
      } else if (Config.partner.enableSigninRegisterCallbacks) {
        partner.call('login');
      }
    }

    $scope.$on("openLoginForm", function(event, action) {
      openSigninForm(action);
    });

    $scope.$on("window.openPopup", function (event, data) {
      $scope.openPopup(data.url, data.title, data.params);
    });

    /* Server To Server Passing Track Id */
    if ($location.search().track_id) {
      Storage.set('trackId', $location.search().track_id);
      $location.search('track_id', undefined);
    }

    /**
     * listen to messages from other windows to open slider tab when needed
     */
    DomHelper.onMessage(function (message) {
      console.log('got message', message.data);
      if (message.data) {
        if (message.data.action) {
          switch (message.data.action) {
            case 'openSlider':
              if (!message.data.tab) {
                return;
              }
              if (message.data.tab === 'settings' && message.data.page) {
                $location.search('settingspage', message.data.page);
              }
              if ($scope.env.authorized) {
                if (message.data.tab === 'login' || message.data.tab === 'register' || message.data.tab === 'signInForm' || message.data.tab === 'sign-in') {return;}
              } else if (message.data.tab === 'deposit' || message.data.tab === 'balanceHistory' || message.data.tab === 'login' || message.data.tab === 'settings' || message.data.tab === 'signInForm' || message.data.tab === 'sign-in') {
                openSigninForm();
                //$location.search('action', message.data.tab);
                return;
              }
              $scope.toggleSliderTab(message.data.tab, '', true);
              break;
            case 'openHelp':
              if (message.data.page) {
                $location.search('help', message.data.page);
                $rootScope.$broadcast('openDeepLinkedHelpPage');
              }
              break;
            case 'closeSlider':
              $scope.env.showSlider = false;
              $scope.env.sliderContent = null;
              break;
            case 'login':
              if (message.data.user_id && message.data.auth_token) {
                AuthData.set({user_id: message.data.user_id, auth_token: message.data.auth_token });
                $scope.restoreLogin();
              }
              break;
            case 'logout':
              logOutUser(false);
              break;
            case 'closeCasinoGame':
              $rootScope.$broadcast('casino.action', {action: 'closeGame', gameId: message.data.gameId});
              break;
            case 'openLiveCasinoHelp':
              $rootScope.globalDialog = {type:'gamerules',title: '',iframeURL:message.data.url};
              break;
            case 'setUrlData':
              $rootScope.$broadcast('casino.action', message.data);
              break;
            case 'closeDialog':
              $rootScope.globalDialog = null;
              break;
            case 'showAlert':
              $rootScope.globalDialog = message.data;
              break;
            case 'switchLayout':
              $scope.switchSportsbookLayout(message.data.layout);
              break;
            case 'addCss':
              message.data.cssUrl && DomHelper.addCss(message.data.cssUrl, null, 'externalCss');
              break;
            case 'doBet':
              message.data.bet && $rootScope.$broadcast('bet', message.data.bet);
              break;
            case 'betSlipBottomOffset':
              if (message.data.offset) {$rootScope.env.betSlipBottomOffset = message.data.offset;}
              break;
            case 'setHeaderData':
              $rootScope.setTitle(message.data.title);
              break;
            case 'openGame':
              if (message.data.game) {$location.path('/game/' + message.data.game);}
              break;
            case 'setLocation':
              if (message.data.reset) {
                $location.search({});
              }
              if (message.data.location) {
                var options = message.data.location;
                var keys = Object.keys(options);

                var queryString = keys.reduce(function (query, key, index) {
                  query += key + '=' + options[key];
                  if (index !== keys.length - 1) {
                    query += '&';
                  }
                  return query;
                }, '?');
                var host = window.location.href.split('?')[0];
                var isSlashExists = host[host.length - 1] === '/' ? '' : '/';

                history.replaceState({}, '', host + isSlashExists + queryString);
              }
              if (message.data.path) {
                $location.path(message.data.path);
              }

              if (message.data.deepLink) {
                $rootScope.$broadcast('sportsbook.handleDeepLinking');
              }
              break;
            case 'setGamesType':
              if ({ 'live': true, 'prematch': true }[message.data.type]) {
                $rootScope.$broadcast('setGamesType', message.data.type === 'live');
              }
              break;
          }
        } else if (Config.main.nemIDAuthentication && message.origin === Config.main.nemIDAuthentication.source) {
          $rootScope.broadcast('handleNemIDMessage', message);
        }
      }
    });

    /**
     * @ngdoc method
     * @name closeSlider
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description as the name says, closes the slider
     */
    $scope.closeSlider = function closeSlider() {
      $location.search('action', undefined);
      $location.search('help', undefined);
      $scope.env.sliderContent = '';
      $scope.env.selectedHelpPageSlug = undefined;
      $scope.balanceSlider.status = true;
      $scope.env.showSlider = false;
      $scope.verytopMenuExpanded = false;
      $rootScope.broadcast("afterCloseSlider");
    };

    $rootScope.$on('slider.close', $scope.closeSlider);

    /**
     * @ngdoc method
     * @name openCustomContent
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description as the name says
     */
    function openCustomContent(event, data) {
      $scope.env.showSlider = true;
      $scope.env.sliderContent = 'customContent';
      $scope.env.sliderCustomContent = data;
    }

    $rootScope.$on('slider.openCustomContent', openCustomContent);

    // Return form logic
    if (Config.main.enableFormUrl && $location.search().formUrl) {
      $http.get($location.search().formUrl).then(
          function (response) {
            $scope.env.showSlider = true;
            $scope.env.sliderContent = 'customContent';
            $scope.env.sliderCustomContent = {type: 'return_form', html: response.data};
          },
          function () {
            console.log('http call failed');
          }
      );
      $location.search('formUrl', undefined); //remove it after displaying
    }

    /**
     * @ngdoc method
     * @name openCustomDialog
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Opens custom dialog return false id dialog config doesnt exist
     */
    $scope.openCustomDialog = function openCustomDialog(type) {
      if (Config.dialog && Config.dialog[type]) {
        var dialog = angular.copy(Config.dialog[type]);
        if (dialog.iframeURL && dialog.params) {
          var sep = '?';
          for (var i = 0; i < dialog.params.length; i += 1) {
            switch (dialog.params[i].key) {
              case 'lang':
                dialog.iframeURL += sep + dialog.params[i].value +  "=" + Config.env.lang;
                sep = '&';
                break;
            }
          }
        }

        $rootScope.globalDialog = dialog;
        return true;
      }

      return false;
    };

    /**
     * @ngdoc method
     * @name getAuthZeroDetails
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Gets auth0 settings from AGP, constructs url and redirect to it
     */
    function getAuthZeroDetails() {
      $scope.closeSlider();
      var uniqueState = Utils.guid();
      Storage.set('auth0_unique_state', uniqueState);
      Zergling.get({network_type: 5, network_domain: $window.location.origin, source: Config.betting.bet_source}, "get_social_network_front_url").then(function(response) {
        if (response.result === 0 && response.details && response.details.Url) {
          Storage.set('auth_0_api', {
            url: response.details.Url,
            key: response.details.ApplicationKey
          });

          $window.location = 'https://' + response.details.Url + '/authorize/?response_type=code&client_id=' + response.details.ApplicationKey +
              '&redirect_uri=' + $window.location.origin + '&scope=openid&' + 'state=' + uniqueState + '&nonce=' + Utils.guid();
        } else {
          $rootScope.$broadcast("globalDialogs.addDialog", {
            type: 'info',
            title: 'Warning',
            content: 'Auth0 is unavailable'
          });
        }
      });
    }

    /**
     * @ngdoc method
     * @name getAuthZeroUser
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Gets token and state from url then checks with storages data and construct user for authentication
     */
    function getAuthZeroUser() {
      var user = null;
      if (Storage.get('auth0_unique_state')) {
        var params = $location.search();

        if (params.state === Storage.get('auth0_unique_state') && params.code) {
          user = {
            authZero: true,
            token: params.code,
            domain: $window.location.origin
          };
        }
        Storage.remove('auth0_unique_state');
        $location.search('code', undefined);
        $location.search('state', undefined);
      }

      return user;
    }

    /**
     * @ngdoc method
     * @name signin
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows/hides the sign-in block
     */
    $scope.signin = function signin() {
      if ($scope.openCustomDialog('loginiframe')) {
        return;
      }

      if (Config.main.authenticationWithAuthZero && Config.main.authenticationWithAuthZero.enabled) {
        getAuthZeroDetails();
        return;
      }

      $scope.toggleSliderTab('login');
    };

    /**
     * @ngdoc method
     * @name register
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows/hides the registration form
     */
    $scope.register = function register() {
      if (!Config.main.registration.enable) {
        notifyNotAvailable();
        return;
      }

      if (Config.main.registration.registrationBlocked) {
        $rootScope.$broadcast("globalDialogs.addDialog", {
          type: 'info',
          title: 'Warning',
          content: Translator.get('Registration on this site is not permitted in selected country.') + ' <b>(' + Translator.get($rootScope.geoCountryInfo.countryName) + ')</b>'
        });
        return;
      }

      if (Config.main.authenticationWithAuthZero && Config.main.authenticationWithAuthZero.enabled) {
        getAuthZeroDetails();
        return;
      }

      if (Config.main.showPopupBeforeRegistration) {
        $rootScope.$broadcast('showPopupBySlug', 'registration-popup');
      }

      if (Config.main.registration.customUrl) {
        $window.location = Config.main.registration.customUrl;
        $scope.env.showSlider = false;
        $scope.env.sliderContent = '';
        return;
      }

      if ($scope.openCustomDialog('regframe')) {
        $scope.env.showSlider = false;
        $scope.env.sliderContent = '';
        return;
      }
      $scope.toggleSliderTab('register');
    };

    /**
     * @ngdoc method
     * @name openForgotPasswordForm
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows/hides the registration form
     */
    $scope.openForgotPasswordForm = function openForgotPasswordForm() {
      if ($scope.openCustomDialog('resetpassword')) {
        $scope.env.showSlider = false;
        $scope.env.sliderContent = '';
        return;
      }
      $scope.toggleSliderTab('forgotPasswordForm');
    };

    $scope.$on("openRegForm", function () {
      if (!Config.main.integrationMode) {
        if ($scope.env.sliderContent !== 'register') {
          $scope.goToTop();
          $scope.register();
        }
      } else if (Config.partner.enableSigninRegisterCallbacks) {
        partner.call('register');
      }
    });

    /**
     * @ngdoc method
     * @name myGamesToggle
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows/hides saved games block
     *
     * @param {Boolean} open optional. if true, will only open tab (won't close if it's already open)
     */
    $scope.myGamesToggle = function myGamesToggle(open) {
      var myGamesTabName;
      if ($scope.env.sliderContent === 'savedGames' || $scope.env.sliderContent === 'casinoSavedGames') {
        myGamesTabName = $scope.env.sliderContent;
      } else {
        myGamesTabName = $rootScope.currentPage.isInCasino || !Config.main.sportSavedGamesEnabled || !$rootScope.calculatedConfigs.sportEnabled ? 'casinoSavedGames' : 'savedGames';
      }
      $scope.toggleSliderTab(myGamesTabName, '', open);
    };

    /**
     * @ngdoc method
     * @name myBetsToggle
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Shows/hides myBets
     *
     * @param {Boolean} open optional. if true, will only open tab (won't close if it's already open)
     */
    $scope.myBetsToggle = function myBetsToggle(open) {
      var sliderContent;

      if (open === undefined && $rootScope.conf.enableCasinoBetHistory && ($rootScope.currentPage.isInCasino || !$rootScope.calculatedConfigs.sportEnabled)) {
        sliderContent = 'casinoBetHistory';
      } else {
        sliderContent = 'recentBets';
      }

      $scope.toggleSliderTab(sliderContent, '', open);
    };

    $scope.$on('open.mygames', function () {$scope.myGamesToggle(true); });
    $scope.$on('open.history', function () {$scope.myBetsToggle(true); });

    /**
     * @ngdoc method
     * @name clock
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description controls the clock in top left corner
     */
    var CLOCK_FORMAT_MAP = {
      '12h': 'hh:mm:ss A',
      '24h': 'HH:mm:ss'
    };
    function clock() {
      $rootScope.env.clock = Moment.get(Date.now()).format(CLOCK_FORMAT_MAP[$rootScope.env.timeFormat]);
    }

    var lastLoggedInDate;
    function  clockWithLoggedInTime() {
      clock();
      $scope.env.loginTime = Moment.moment.utc(Date.now() - lastLoggedInDate).format("HH:mm:ss");
    }

    clock();

    var timingStrategyPromise = $interval(clock, 1000);

    /**
     * @ngdoc function
     * @name removeAllFavorites
     * @methodOf vbet5.controller:gamesCtrl
     * @description Clean all favorites competitions/games
     */
    function removeAllFavorites() {
      var myGames = angular.copy($rootScope.myGames);
      $scope.$emit('game.removeGameFromMyGames', myGames);
    }
    $scope.$on('game.removeAllFavorites', removeAllFavorites);

    /**
     * @ngdoc method
     * @name logOutUser
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Logs user out
     * @param {Boolean} dontClearAllData don't clear local storage data
     */
    function logOutUser(dontClearAllData) {
      if($rootScope.editBet && $rootScope.editBet.edit) {
        $rootScope.editBet.edit = false;
        $rootScope.editBet.oldBetId = 0;
        $rootScope.$broadcast('close.edit.mode');
      }
      dontClearAllData = dontClearAllData || false;
      var logoutDone = false;
      var doLogoutStuff = function () {
        if (!logoutDone && $scope.env.authorized !== false) {
          logoutDone = true;
          $rootScope.profile = null;
          $scope.env.authorized = false;
          $rootScope.currency_name = null;
          $rootScope.fbLoggedIn = false;
          $rootScope.cannotLoginWIthFbId = false;
          if ($rootScope.odnoModel) {
            $rootScope.odnoModel.currentAction = null;
            $rootScope.odnoModel.cannotLoginWIthOdno = null;
            $rootScope.odnoModel.loggedIn = false;
          }
          AuthData.clear();
          $rootScope.loginRestored = $q.reject();
          if (!dontClearAllData) {
            if (Config.betting.clearOnLogout) {
              Storage.remove('betslip');
              Storage.remove('vs_favorite_market_types');
              Storage.remove('favouriteMarketsTypes');
            }
            Storage.remove('myGames');
            removeAllFavorites();
            Storage.remove('prematchMultiViewGames');
            Storage.remove('prematchMultiViewCompetitions');
            Storage.remove('timezone');
            Storage.remove('qrCodeOrigin');
          }
          $rootScope.$broadcast('login.loggedOut');

          $scope.closeSlider();
          liveChat.initSFChat();
        }
      };
      Zergling.logout()['finally'](doLogoutStuff);
      $timeout(doLogoutStuff, Config.main.logoutTimeout); //in case logout fails for some reason (no network, etc.)
    }
    $scope.$on('doLogOut', logOutUser);

    /**
     * @ngdoc method
     * @name logOut
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Logs out
     */
    $scope.logOut = function logOut() {
      if (Config.main.authenticationWithAuthZero && Config.main.authenticationWithAuthZero.enabled) {
        AuthData.clear();
        var authZeroAPI = Storage.get('auth_0_api') || {};
        $window.location = 'https://' + authZeroAPI.url + '/v2/logout?client_id=' + authZeroAPI.key + '&returnTo=' + $window.location.origin;
        return;
      }

      if ($rootScope.fbLoggedIn) {
        $rootScope.yesNoDialog = Translator.get("Do you want to log out from Facebook as well? If you don't log out from Facebook, you will be automatically logged in next time you open this page.");
        $scope.$on('dialog.yes', function () {
          logOutUser();
          $rootScope.$broadcast('facebook.logout');
        });
        $scope.$on('dialog.no', logOutUser);

      } else {
        logOutUser();
      }
    };

    /**
     * @ngdoc method
     * @name goToTop
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Scrolls to beginning of page on small screen resolutions (defined by MIN_HEIGHT_FOR_STICKY_SLIDER)
     * Returns $scope, so it can be chained with scope methods
     * @param {Boolean} [onSmallScreensOnly] optional. if set to true will scroll only on small screens
     * @returns {Object} $scope
     */
    $scope.goToTop = function goToTop(onSmallScreensOnly) {
      DomHelper.goToTop(onSmallScreensOnly);
      return $scope;
    };

    /**
     * @ngdoc method
     * @name updateProfileBalance
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Update profile balance
     *
     */
    function updateProfileBalance () {
      if ($rootScope.profile) {
        $rootScope.profile.calculatedBalance = !$rootScope.profile.frozen_balance ? $rootScope.profile.balance : Math.max($rootScope.profile.balance - $rootScope.profile.frozen_balance, 0);
        $rootScope.profile.calculatedBonus = $rootScope.profile.bonus_balance || 0; // in some cases profile.bonus_balance is undefined
      }
    }

    /**
     * @ngdoc method
     * @name updateProfile
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Receives profile update messages broadcasted by other controllers and updates profile in $scope
     *
     * @param {Object} event event
     * @param {Object} data profile data
     */
    function updateProfile(event, data) {
      if (!data || Utils.isObjectEmpty(data.profile)) {
        return;
      }

      if ($rootScope.profile) {
        Utils.MergeRecursive($rootScope.profile, $filter('firstElement')(data.profile));
      } else {
        $rootScope.profile = $filter('firstElement')(data.profile);
      }

      if ($rootScope.profile) {
        if ($rootScope.profile.last_name) {
          $rootScope.profile.sur_name = $rootScope.profile.last_name;
        }
        if ($rootScope.profile.first_name && $rootScope.profile.last_name) {
          $rootScope.profile.full_name = $rootScope.profile.first_name + " " + $rootScope.profile.last_name;
        } else if ($rootScope.profile.first_name) {
          $rootScope.profile.full_name = $rootScope.profile.first_name;
        } else if ($rootScope.profile.last_name) {
          $rootScope.profile.full_name = $rootScope.profile.last_name;
        } else {
          $rootScope.profile.full_name = "";
        }
        if (Config.main.balanceUpdateDelay && $rootScope.profile.calculatedBalance && $rootScope.casinoGameOpened) {
          $timeout(updateProfileBalance, Config.main.balanceUpdateDelay);
        } else {
          updateProfileBalance();
        }

        if ($rootScope.profile.bonus_win_balance !== undefined) {
          $rootScope.profile.calculatedBonus += $rootScope.profile.bonus_win_balance;
        }
        if ($rootScope.profile.frozen_balance !== undefined) {
          $rootScope.profile.calculatedBonus += $rootScope.profile.frozen_balance;
        }
      }
      $rootScope.currency_name = $scope.profile.currency_name;
      console.log('profile', $scope.profile);
      if (($rootScope.calculatedConfigs.sportEnabled || Config.main.remindToRenewBalance.casino) && Config.main.remindToRenewBalance.enabled && $rootScope.profile && $rootScope.profile.balance !== undefined) {
        if (Storage.get('renewReminded') === undefined && $rootScope.profile.calculatedBalance + $rootScope.profile.calculatedBonus < Config.main.remindToRenewBalance.threshold  && $scope.env.sliderContent !== 'cashier') {

          if (Config.main.remindToRenewBalance.dialog) {
            $rootScope.$broadcast("globalDialogs.addDialog", Config.main.remindToRenewBalance.dialog);
          } else {
            $scope.env.showSlider = true;
            $scope.env.sliderContent = 'warning';
          }

          Storage.set('renewReminded', $rootScope.profile.balance, Config.main.remindToRenewBalance.interval);
        } else { // on balance increase clear the reminder state to remind again when balance is low again
          if ($rootScope.profile.calculatedBalance > Storage.get('renewReminded')) {
            Storage.remove('renewReminded');
          }
        }
      }

      if (!$rootScope.env.unreadCountOld) {
        $rootScope.env.unreadCountOld = $rootScope.profile.unread_count;
      }

      $rootScope.env.isNewMessage = $rootScope.profile.unread_count !== $rootScope.profile.unreadCountOld;

      liveChat.liveAgentProfileUpdate && liveChat.liveAgentProfileUpdate();
      liveChat.zopimProfileUpdate && liveChat.zopimProfileUpdate($rootScope.profile);
    }

    $scope.$on('profile', function (event, data) {
      updateProfile(event, data);
      if ($rootScope.profile) {
        if (Config.main.liveChat && (Config.main.liveChat.isSfChat || Config.main.liveChat.isDeskChat || (Config.main.liveChat.siteId && Config.main.liveChat.getUserId))) {
          if ($rootScope.env.authorized && $scope.lastUserId !== $rootScope.profile.unique_id) {
            $scope.lastUserId = $scope.profile.unique_id;
            Zergling.get({}, 'get_user').then(Config.main.liveChat.isSfChat ? liveChat.setSFChatData : liveChat.setChatData);
          }
        }
      }
    });

    $scope.$on('profile.refresh', function () {
      Zergling.get({}, 'get_user').then(function (data) {
        if (data && data.user_id) {
          var profileData = {
            profile: {}
          };
          profileData.profile[data.user_id] = data;
          updateProfile(null, profileData);
        }
      });
    });

    /**
     * notifies controllers about window size changing
     */
    DomHelper.onWindowResize(function () {
      $rootScope.$broadcast('onWindowResize');
    });

    /**
     * notifies controllers about window width size changing
     */
    DomHelper.onWindowWidthResize(function () {
      $rootScope.$broadcast('onWindowWidthResize');
    });

    /**
     * notifies controllers about window scrolling
     */
    DomHelper.onWindowScroll(function () {
      $rootScope.$broadcast('onWindowScroll');
    });

    /**
     * @ngdoc method
     * @name restoreLogin
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Restores login from saved auth session and subscribes to profile updates
     */
    $scope.restoreLogin = function restoreLogin() {
      var deferred = $q.defer();

      var authZeroUser = getAuthZeroUser();

      if (authZeroUser || AuthData.getAuthToken()) {
        console.log('restoring login');
        Zergling.login(authZeroUser || null).then(
            function (response) {
              if (!Config.env.authorized) {
                logOutUser();
                return deferred.reject("Token is invalid need to authorise");
              }

              if (authZeroUser && Config.main.iovationLoginScripts && window.IGLOO) {
                var ioData = window.IGLOO.getBlackbox();
                Zergling.get({io_black_box: ioData.blackbox, player:  response.data.is_new_client ? 'new': 'old'}, 'send_iovation_payload').then(
                    function(ioResponse) {
                      console.log(ioResponse);
                    });
              }

              if ($scope.env.sliderContent === 'login' || $scope.env.sliderContent === 'register') {
                $scope.env.showSlider = false;
                $scope.env.sliderContent = '';
              }

              Zergling
                  .subscribe({'source': 'user', 'what': {'profile': []}, 'subscribe': true}, function (data) {updateProfile(null, data); })
                  .then(function (result) {
                    var lastLogin = Storage.get('loginFlow');
                    if (lastLogin === 'ODNO') {
                      $rootScope.odnoModel.loggedIn = true;
                    }
                    $rootScope.$broadcast('profile', result.data);
                    $rootScope.$broadcast('loggedIn');
                    deferred.resolve(true);
                  });
            },
            function (response) {
              console.log('login with stored auth token failed');
              return deferred.reject(response);
            }
        );
      } else {
        console.log('no saved auth token');
        return $q.reject(null);
      }
      return deferred.promise;
    };


    /**
     * @ngdoc method
     * @name scrollToElement
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  smoothly scrolls page to element with specified id
     */
    $scope.$on('scrollTo', function (event, elementId) {
      if (UserAgent.IEVersion()) {
        $window.scroll(0, 0);
      } else {
        smoothScroll(elementId);
      }
    });

    function reloadLocation() {
      $timeout(function() {
        $window.location.reload();
      }, 100);
    }
    /**
     * @ngdoc method
     * @name selectLanguage
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  changes site language
     *
     *
     * @param {String} code language code
     * @param {boolean} setPreferredLanguage language code change
     */
    $scope.selectLanguage = function selectLanguage(code, setPreferredLanguage) {

      $scope.showLangSelector = false;

      if (code === $scope.env.lang) return;
      //Config.env.lang = code;
      $location.search('lang', code);
      $location.search('page', undefined); //clear pages slugs, because
      $location.search('help', undefined); //they are different for different languages
      Storage.set('lang', code);

      Utils.checkAndSetCookie('lang', code, Config.main.authSessionLifetime);

      if (setPreferredLanguage && $rootScope.env.authorized) {
          var shortCode = Config.main.availableLanguages[code]['short'].toLowerCase();
          Zergling.get({'language': shortCode}, 'set_preferred_language').then(function (response) {
          })['finally'](function () {
              reloadLocation();
          });
      } else {
          reloadLocation();
      }

    };

    if (Config.main.geoIPLangSwitch && Config.main.geoIPLangSwitch.enabled) {
      $rootScope.geoDataAvailable = $rootScope.geoDataAvailable || Geoip.getGeoData(false);
      $rootScope.geoDataAvailable.then(function (data) {
        var country = data && data.countryCode && data.countryCode.toUpperCase();
        var switchTo = CountryCodes[country];
        var langs = Config.main.availableLanguages;
        var langToSelect;

        // Change odds format depending on the country
        if (!Storage.get('oddFormat') && country && Config.main.geoIPLangSwitch.oddsByCountry && Config.main.geoIPLangSwitch.oddsByCountry[country]) {
          $scope.setOddFormat(Config.main.geoIPLangSwitch.oddsByCountry[country]);
        }

        // Change view depending on the country
        if (!Storage.get('sportsBookLayout') && country && Config.main.geoIPLangSwitch.layoutByCountry && Config.main.geoIPLangSwitch.layoutByCountry[country]) {
          $scope.switchSportsbookLayout(Config.main.geoIPLangSwitch.layoutByCountry[country]);
        }

        if (!$location.search().lang && !$location.search().action) {
          if (!Storage.get('languageHasBeenSwitched')) {
            if (Config.main.geoIPLangSwitch[country] && langs[Config.main.geoIPLangSwitch[country]]) {
              langToSelect = Config.main.geoIPLangSwitch[country];
            } else if (switchTo && switchTo.lang && langs[switchTo.lang]) {
              langToSelect = switchTo.lang;
            } else if (Config.main.geoIPLangSwitch.default) {
              langToSelect = Config.main.geoIPLangSwitch.default;
            }
            if (langToSelect) {
              $scope.selectLanguage(langToSelect);
              $timeout(function () {Storage.set('runtimePopupShowed', false); }, 100);
            }
          }
          Storage.set('languageHasBeenSwitched', true);
        }
      });
    }

    /**
     * @ngdoc method
     * @name switchSportsbookLayout
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  changes site language
     *
     * @param {String} type classic , modern, asian
     */
    $scope.switchSportsbookLayout = function switchSportsbookLayout(type) {
      if (Config.main.sportsLayout === type) {
        return;
      }
      Storage.set('sportsBookLayout', type);

      Utils.checkAndSetCookie('sportsBookLayout', type, Config.main.authSessionLifetime);

      partner.call('switchSportsbookLayout', type);

      // https://betconstruct.atlassian.net/browse/WEB-4701 ;)
      if ($location.path().indexOf('multiview') > -1 && type === 'modern') {
        $location.url('/sport/?type=1');
      }

      if (AuthData.integrationMode && AuthData.partnerAuthData) { // need to write data in location for  restoring login after layout switching
        if (AuthData.partnerAuthData.auth_token) {
          $location.search('AuthToken', AuthData.partnerAuthData.auth_token);
        }
        if (AuthData.partnerAuthData.user_id) {
          $location.search('UserId', AuthData.partnerAuthData.user_id);
        }
      }
      $rootScope.broadcast("changingSportsbookLayout");
      reloadLocation();
    };

    $rootScope.switchSportsbookLayout = $scope.switchSportsbookLayout;

    $scope.$on('switchSportsbookLayout', function (event, layout) {$scope.switchSportsbookLayout(layout); });

    $scope.$on('sportsbook.setLayout', function (event, data) {
      $scope.switchSportsbookLayout(data);
    });

    $scope.dontShowLayoutSwitcherHintAgain = false;

    /**
     * @ngdoc method
     * @name settingsInit
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  initializes settings. Checks if odds format was set before and loads it from local storage
     *
     */
    function settingsInit() {
      if (Config.main.oddFormats && Config.main.oddFormats.length === 1) {
        $scope.setOddFormat(Config.main.oddFormats[0].format);
      } else if (Storage.get('oddFormat') !== undefined) {
        $scope.setOddFormat(Storage.get('oddFormat'));
      }
      if (Storage.get('hideUsername') !== undefined) {
        $scope.setHideUsername(Storage.get('hideUsername'));
      }
      if (Storage.get('hideBalance') !== undefined) {
        $scope.setHideBalance(Storage.get('hideBalance'));
      }
      if (Storage.get('timeFormat') !== undefined) {
        $scope.setTimeFormat(Storage.get('timeFormat'));
      }
    }

    /**
     * @ngdoc method
     * @name setTimeFormat
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  sets the time format
     *
     * @param {String} value time format (24 hour format or 12 hour AM/PM format)
     */
    $scope.setTimeFormat = function setTimeFormat(value) {
      Config.env.timeFormat = value;
      Storage.set('timeFormat', value);
    };

    $scope.$on('setTimeFormat', function (event, format) {$scope.setTimeFormat(format); });
    /**
     * @ngdoc method
     * @name setHideUsername
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  show/hide username
     *
     * @param {Boolean} value username state (true, false)
     */
    $scope.setHideUsername = function setHideUsername(value) {
      Config.env.hideUsername = value;
      Storage.set('hideUsername', value);
    };

    /**
     * @ngdoc method
     * @name setHideBalance
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  show/hide balance
     *
     * @param {Boolean} value balance state (true, false)
     */
    $scope.setHideBalance = function setHideBalance(value) {
      Config.env.hideBalance = value;
      Storage.set('hideBalance', value);
    };

    /**
     * @ngdoc method
     * @name setOddFormat
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  sets the odds format
     *
     * @param {String} format odd format (decimal, fractional or american)
     */
    $scope.setOddFormat = function setOddFormat(format) {
      Config.env.oddFormat = format;
      Storage.set('oddFormat', format);
    };

    $scope.setSound = GameInfo.setSound;

    $scope.$on('setOddsFormat', function (event, format) {$scope.setOddFormat(format); });

    $scope.$on('zergling.lostWSConnection', function () {
      connectionLost = true;
      $scope.topMessage = Translator.get('Connection lost. Reconnecting.');
    });

    $scope.$on('zergling.gotSession', function () {
      if (connectionLost) {
        connectionLost = false;
        $scope.topMessage = null;
        Utils.setJustForMoment($scope, 'topMessage', Translator.get('Connection restored'), 5000);
      }

    });


    /**
     * @ngdoc method
     * @name setSuggestedExpress
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  changes the value of suggested bets (pre match type) in Storage
     */
    $scope.setSuggestedExpress = function setSuggestedExpress() {
      if ($scope.suggestedBets !== 'hide') {
        $scope.suggestedBets = 'hide';
        Storage.set("suggestedBets", "hide");
      } else {
        $scope.suggestedBets = true;
        Storage.set("suggestedBets", true);
      }
    };

    if (Config.main.enableSuggestedBets) {
      $scope.suggestedBets = Storage.get('suggestedBets') || true;

      $scope.$on("turnOffSuggestedExpress", function() {
        $scope.setSuggestedExpress();
      });
    }

    /**
     * @ngdoc method
     * @name check4DeepLinkedAction
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  checks if corresponding slider section has to be opened(if action is speciified in url) and returns its state
     * @param {String} actionPage action section name, e.g. 'deposit', 'cashier', etc.
     * @param {Boolean} andOpenIt if true, corresponding page will be opened, if not specified will just return the state
     *@return {Boolean} if cashier action is specified
     */
    function check4DeepLinkedAction(actionPage, andOpenIt) {
      var action = $location.search().action;
      if(!Config.main.transferEnabled && action === 'cashier') {
        $location.search('action', undefined);
        return false;
      }
      if(action && action.length && action.toLowerCase() === actionPage.toLowerCase()){
        if(actionPage === 'payments' && $scope.env.sliderContent !== 'deposit'){
          if (andOpenIt) {
            $scope.env.paymentListShown = true;
            $scope.toggleSliderTab('deposit');
            $location.search('action', undefined);
          }
        }else if(actionPage === 'forgotPassword' &&  $scope.env.sliderContent !== 'forgotPasswordForm'){
          if (andOpenIt) {
            if(!$scope.env.authorized){
              $scope.openForgotPasswordForm();
            }
            $location.search('action', undefined);
          }
        }else if(actionPage !== 'payments' && actionPage !== 'forgotPassword' && $scope.env.sliderContent !== actionPage){
          if(actionPage === 'promotionalBonuses' && !Config.main.promotionalBonuses.enable) {
            return false;
          }
          if (andOpenIt) {
            $scope.toggleSliderTab(actionPage);
            $location.search('action', undefined);
          }
          return true;
        }

      }
      return false;
    }

    /**
     * @ngdoc method
     * @name updatePoolBettingData
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  calculates and updates scope's poolbetting jackpot value
     *
     * @param {Object} response  draw response ibject
     */
    function updatePoolBettingData(response) {
      var draw = response.data && $filter('firstElement')(response.data.draw);
      if (!draw) {
        console.warn('cannot get pool betting draw', response);
        return;
      }
      if (!draw.jackpot || draw.jackpot <= draw.min_jackpot) {
        draw.jackpot = draw.min_jackpot;
      }
      $rootScope.poolBettingJackpot = draw.jackpot;
      console.log('Pool betting jackpot:', response);
    }

    /**
     * @ngdoc method
     * @name performDeepLinkedAction
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Handles different actions from url and opens corresponding slider section
     */
    function performDeepLinkedAction() {
      check4DeepLinkedAction('cashier', true);
      check4DeepLinkedAction('myWallets', true);
      check4DeepLinkedAction('deposit', true);
      check4DeepLinkedAction('withdraw', true);
      check4DeepLinkedAction('settings', true);
      check4DeepLinkedAction('betHistory', true);
      check4DeepLinkedAction('balanceHistory', true);
      check4DeepLinkedAction('casinoBalanceHistory', true);
      check4DeepLinkedAction('recentBets', true);
      check4DeepLinkedAction('payments', true);
      check4DeepLinkedAction('forgotPassword', true);
      check4DeepLinkedAction('promotionalBonuses', true);

    }

    /**
     * @ngdoc method
     * @name needLogin2Continue
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Returns true if section requires a login first
     */
    function needLogin2Continue() {
      return check4DeepLinkedAction('cashier') || check4DeepLinkedAction('myWallets') || check4DeepLinkedAction('betHistory') || check4DeepLinkedAction('deposit') || check4DeepLinkedAction('withdraw') || check4DeepLinkedAction('settings') || check4DeepLinkedAction('balanceHistory') || check4DeepLinkedAction('casinoBalanceHistory') ||check4DeepLinkedAction('recentBets') || check4DeepLinkedAction('promotionalBonuses') ;
    }

    /**
     * @ngdoc method
     * @name mainHeaderInit
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  main header initialization.
     * restores login, checks if actions are specified in url (like register, cashier) and performs them
     */
    $scope.mainHeaderInit = function mainHeaderInit() {
      var locationData = $location.search();
      if (locationData.auth_token && locationData.user_id) {
        AuthData.set({user_id: locationData.user_id, auth_token: locationData.auth_token});
      }
      $rootScope.loginRestored = $scope.restoreLogin();
      $rootScope.loginRestored.then(
          performDeepLinkedAction,  //login done
          function () { //login failed
            if (needLogin2Continue()) {
              openSigninForm();
            }else{
              $timeout(performDeepLinkedAction, 0);
            }
            if ($location.search().action) {
              Storage.set('ref', $location.search().ref);
              if ($location.search().action.toLowerCase() === 'register' && $scope.env.sliderContent !== 'register') {
                $timeout($scope.register, 1200);
                $location.search('action', undefined);
              } else if ($location.search().action.toLowerCase() === 'login' && $scope.env.sliderContent !== 'login') {
                openSigninForm();
                $location.search('action', undefined);
              }  else if ($location.search().action.toLowerCase() === 'fblead' && $scope.env.sliderContent !== 'register') {
                $scope.goToTop();
                $scope.env.showSlider = true;
                $scope.env.sliderContent = 'register';
                Storage.set('fbRequestIds', $location.search().request_ids);
                Storage.remove('ref'); //
//                            $location.search('action', undefined);
              }
            }
          }
      )['finally'](function () {
        $location.search('auth_token', undefined);
        $location.search('user_id', undefined);
      });
      if ($location.search().action && $location.search().action.toLowerCase() === 'livechat') {
        $scope.startLiveAgent();
        $location.search('action', undefined);
      }

      $scope.$on('liveAgent.start', function () {
        $scope.startLiveAgent();
      });

      $scope.$on('zopim.start', function () {
        $window.showZopimChat();
      });

      $scope.$on('comm100.start', function() {
        $window.startLiveChat();
      });

      if ($location.search().tablet) {
        $scope.isTablet = true;
      }

      if ($rootScope.calculatedConfigs.poolBettingEnabled|| Config.main.poolBettingJackpotOnHomepage) {
        Zergling.get({
          'source': 'config.currency',
          'what': {'currency': ['name', 'rounding', 'toto_rate'] },
          'where': { 'currency': { 'name': Config.main.poolBettingCurrencyName}}
        }).then(function (response) {
          if (response.data && response.data.currency) {
            $rootScope.poolBettingCurrency = $filter('firstElement')(response.data.currency);
            connectionService.subscribe(
                {
                  'source': 'pool.betting',
                  'what': { 'draw': ['jackpot', 'min_jackpot']},
                  'where': { 'draw': {'status': 1}}
                },
                updatePoolBettingData
            );
          }
        });
      }

      $scope.sortedAvailableLanguages = Utils.objectToArray(Config.main.availableLanguages, 'code').sort(Utils.orderSorting);

      if ($rootScope.calculatedConfigs.virtualSportsEnabled) { // virtual sport case
        if ($location.path() === '/sport/' && $location.search().sport === "-3") {
          $location.path('/virtualsports/');
        }
      }

      settingsInit();
      loadPasswordRules();


    };

    $scope.$on('$routeUpdate',   function () {
      if (Config.env.authorized) {
        performDeepLinkedAction();
      } else if (needLogin2Continue()) {
        openSigninForm();
      }else{
        performDeepLinkedAction();
      }

      if (Config.partner && Config.partner.routeUpdateCallback) {
        var routeParams = {
          route: $location.path()
        };

        angular.forEach($location.search(), function (param, name) {
          routeParams[name] = param;
        });

        partner.call('routeUpdate', routeParams);
      }

      if (appHasBeenUpdated) {
        reloadLocation();
      }

      if ($location.search().reload) {
        $location.search('reload', undefined);
        reloadLocation();
      }
    });
    /**
     * @ngdoc method
     * @name checkAndCorrectPath
     * @description  checking path is not enabled redirects to home page
     */
    var checkAndCorrectPath = function checkAndCorrectPath() {
      var path = $location.path();
      var lastCharacter = path.substr(path.length - 1);
      if (path !== '/' && lastCharacter === '/') {
        path = path.substr(0, path.length - 1);
      }
      var defaultAvailability = path === '/' || path.indexOf('/game/') !== -1 || path.indexOf('/skinning') !== -1 || path.indexOf('/widget/') !== -1 || path.indexOf('/landpage') !== -1 || path.indexOf('/help') !== -1 || Config.main.defaultAvailablePaths.indexOf(path) !== -1;
      path = "#" + path;

      if(defaultAvailability && defaultAvailability[defaultAvailability.length - 1] !== '/') {
        defaultAvailability += '/';
      }

      if(!defaultAvailability && !$rootScope.ignorePathValidation  && !$rootScope.validPaths[path] && !$rootScope.validPaths[path + "/"]) {
        $location.url("/");
      }
      if($rootScope.ignorePathValidation){
        $rootScope.ignorePathValidation = undefined;
        RoutesValidity.makeValid(path);
      }
    };

    checkAndCorrectPath();

    $scope.$on('$routeChangeStart', function () {
      $rootScope.casinoGameOpened = 0;
      $rootScope.footerMovable = false;
      checkAndCorrectPath();
    });

    $scope.$on('root.checkAndCorrectPath', function () {
      checkAndCorrectPath();
    });

    /**
     * @ngdoc method
     * @name setGamesType
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  sets game type(live or pre-match) by sending a broadcast message to controller
     */
    $scope.setGamesType = function setGamesType(type) {
      if ($rootScope.env.live !== type) {
        $rootScope.$broadcast('toggleLive');
        Config.env.live = !!type;
        if (Config.main.sportsLayout === 'asian') {
          $rootScope.$broadcast('asianMenu');
        }
      }
      if ($location.path() !== '/sport/' && !type) {
        $location.path("/sport").search('type', 0);
      }
    };

    /**
     * @ngdoc method
     * @name setGamesType
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description detects spring id and converts it to basalt game id and opens a sportsbook with this id.
     */
    function detectGameExternalId () {
      if ($location.search().gameexternal) {
        $location.search('game', $location.search().gameexternal);
        $location.search('gameexternal', undefined);
      }
    }

    detectGameExternalId();

    /**
     * @ngdoc method
     * @name setDefaultIfVirtual
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  sets game type(pre-match) to difault if virtual sport is selected
     */
    $scope.setDefaultIfVirtual = function setDefaultIfVirtual() {
      if ($location.search().sport === -3 && $rootScope.calculatedConfigs.sportEnabled) {
        $timeout(function() {$route.reload();}, 100);
      }
    };

    $scope.$on('setGamesType', function (event, type) {$scope.setGamesType(type); });

    $scope.startSFChat = liveChat.startSFChat;
    $scope.startDeskChat = liveChat.startDeskChat;
    $window.startSFChat = $scope.startSFChat; //to use it on wordpress pages

    if (Config.main.liveChat && Config.main.liveChat.isLiveAgent) {
      liveChat.initLiveAgent();
      $scope.isLiveAgent = true;
    }

    /**
     * @ngdoc method
     * @name startLiveAgent
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description opens a LiveAgent chat
     */
    $scope.startLiveAgent = function () {
      var chat = Config.main.liveChat && (Config.main.liveChat[Config.env.lang] || Config.main.liveChat);
      if (liveChat.liveAgentButton && liveChat.liveAgentButton.onClick && (liveChat.liveAgentButton.chat || chat.liveAgentVersion === 2)) {
        liveChat.liveAgentButton.onClick();
        return;
      }
      $timeout($scope.startLiveAgent, 500);
    };

    $window.startLiveAgent = $scope.startLiveAgent;
    /**
     * @ngdoc method
     * @name openFaq
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description  opens FAQ popup window
     */
    $scope.openFaq = function openFaq() {
      $rootScope.$broadcast('openHelpPage', {slug: 'faq'});
    };

    /**
     * @ngdoc method
     * @name getAllowedPaymentSystems
     * @description  Retrieve from swarm allowed payment systems
     */
    function getAllowedPaymentSystems() {

      if (Config.main.integrationMode) {
        return;
      }

      Zergling.get({}, 'payment_services').then(function (response) {
        $rootScope.profile.paymentSystems = response;
        $rootScope.$broadcast('slider.processUserAuthorization');
      }, function (err) {
        console.log('Payments methods not loaded: ', err);
      });
    }

    /**
     * @ngdoc method
     * @name openPopup
     * @description  openas a popup window
     * @param {String} url page url
     * @param {String} title page title
     * @param {String} params page additional parameters
     */
    $scope.openPopup = function openPopup(url, title, params) {
      $window.open(url, title, params);
    };

    /**
     * @ngdoc method
     * @name openUrl
     * @description  openas a url
     * @param {String} url page url
     */
    $scope.openUrl = function openUrl(url) {
      $window.location = url;
    };

    /**
     * @ngdoc method
     * @name switchIntegratedTo
     * @description  switches integrated sportsbook mode
     * @param {String} type "live" or "prematch"
     */
    $scope.switchIntegratedTo = function switchIntegratedTo(type) {
      $window.htmlHelper.switchTo(type);
    };

    /**
     * @ngdoc method
     * @name setTheme
     * @description  sets color scheme
     * @param {Object} theme them object
     */
    $scope.setTheme = function setTheme(theme) {
      $rootScope.theme = theme;
      Storage.set('theme', theme.id);

      DomHelper.clearCss();
      if (theme.css) {
        var css = DomHelper.addCss(theme.css);
        $scope.isCssLoading = true;
        css.onload = function () {
          $scope.isCssLoading = false;
          $scope.$apply();
        };
      }
    };

    // load saved or default theme
    if (Config.main.themes && Config.main.themes.length) {
      var savedTheme = Storage.get('theme') ? Utils.getArrayObjectElementHavingFieldValue(Config.main.themes, 'id', Storage.get('theme')) : null;
      $scope.setTheme(savedTheme || Config.main.themes[0]);
    }

    // custom css
    if ($location.search().css) {
      DomHelper.addCss($location.search().css, null, 'externalCss');
      $location.search('css', undefined);
    }

    /**
     * Event listener to make bridge between registration ctrl and login ctrl
     * Redirect login request to login controller
     */
    $scope.$on('login.withUserPass', function (event, data) {
      $scope.$broadcast('login.withUsernamePassword', data);
    });

    $scope.openBalancePage = function openBalancePage() {
      $scope.env.showSlider = true;
      $scope.env.sliderContent = $rootScope.currentPage.isInSports ? Config.main.balanceDefaultPage : (Config.main.casinoBalanceDefaultPage || 'cashier');
    };

    /**
     * @ngdoc method
     * @name watchAuthData
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Authorization token watcher and performs logout if changed
     */
    function watchAuthData() {
      var authDataWatcher = $scope.$watch(function () { return Storage.get("auth_data") && Storage.get("auth_data").auth_token || $cookies.getObject('auth_data') && $cookies.getObject('auth_data').auth_token || AuthData.partnerAuthData || null; }, function (newVal, oldVal) {
        if (!newVal && $rootScope.env.authorized) {
          logOutUser();
          authDataWatcher();
        }
      });
    }

    /**
     * @ngdoc method
     * @name checkAndAddUserReport
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Check config and add external report scripts
     */
    function checkAndAddUserReport() {
      if (Config.main.userReportScripts) {
        angular.forEach(Config.main.userReportScripts, function(reportScript) {
          Script(reportScript + '?userid=' + AuthData.get().user_id);
        });
      }
    }

    $scope.$on('analytics.button', function (event, name) {
      console.log('button clicked',  name);
      analytics.gaSend('send', 'event', 'button', 'click',  {'page': $location.path(), 'eventLabel': name});
    });

    $scope.$on('header.register', function () {
      $scope.register();
    });

    //for handle non activiy action
    var nonActivityInterval, checkingInterval, mousemoveCounter = 0, checkingIntervalPromise;

    /**
     * @ngdoc method
     * @name mousemove
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Handles mouse move events used to detect inactive users
     */
    function mousemove() {
      mousemoveCounter++;
      if (mousemoveCounter > 20) {
        nonActivityInterval = 0;
        mousemoveCounter = 0;
      }
    }

    /**
     * @ngdoc method
     * @name mousemove
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Handles mouse click events used to detect inactive users
     */
    function mouseup() {
      nonActivityInterval = 0;
      mousemoveCounter = 0;
    }

    /**
     * @ngdoc method
     * @name toActivationProcess
     * @description  restores WS connection and starts non activity checking
     */
    function toActivationProcess() {
      $document.off('mousemove', toActivationProcess);
      $document.off('mouseup', toActivationProcess);

      $rootScope.inactiveMode = false;

      Zergling.restoreConnection();

      nonActivityInterval = 0;
      checkingInterval = Config.main.nonActivityAction.checkingInterval || 1000;

      checkingIntervalPromise = setInterval(nonActivityAction, checkingInterval);
    }
    /**
     * @ngdoc method
     * @name nonActivityAction
     * @description  Non Activity Action
     */
    function nonActivityAction() {
      if($rootScope.casinoGameOpened) {
        return;
      }
      nonActivityInterval = nonActivityInterval + checkingInterval / 1000;
      if (nonActivityInterval > Config.main.nonActivityAction.nonActivityInterval) {
        nonActivityInterval = 0;
        switch (Config.main.nonActivityAction.action) {
          case 'disconnect':
            Zergling.closeConnection();
            clearInterval(checkingIntervalPromise);
            $rootScope.inactiveMode = true;
            $document.on('mousemove', toActivationProcess);
            $document.on('mouseup', toActivationProcess);

            break;
          case 'logout':
            if(Config.env.authorized) {
              logOutUser(true);
            }
            return;
          case 'reload':
            $route.reload();
            return;
        }
      }
    }

    if (Config.main.nonActivityAction) {
      nonActivityInterval = 0;
      checkingInterval = Config.main.nonActivityAction.checkingInterval || 1000;

      $document.on('mousemove', mousemove);
      $document.on('mouseup', mouseup);
      checkingIntervalPromise = setInterval(nonActivityAction, checkingInterval);
    }

    $scope.sportsbookAvailableViews = Utils.checkForAvailableSportsbookViews(Config);


    $scope.timezones = TimezoneService.data;
    $scope.setTimezoneSwitcherValue = TimezoneService.setTimezoneSwitcherValue;

    $scope.setTimezoneSwitcherValue(TimezoneService.getTimezoneSwitcherInitialValue(), true);

    /**
     * @ngdoc method
     * @name showCouponDetails
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Does a broadcast to show Cupon details
     */
    $scope.showCouponDetails = function showCouponDetails(betId) {
      $rootScope.$broadcast('couponCheck.showDetails', betId);
    };

    $rootScope.Math = Math;

    var routChangePromise;

    /**
     * @ngdoc method
     * @name domainSpecificCheck
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Domain check for specifix prefixes and change url if needed
     */
    function domainSpecificCheck(path, event) {
      if (Config.main.domainSpecificPrefixes[$window.location.hostname]) {

        if (path === '#/' && !$rootScope.casinoEnabled && $window.location.hostname === 'gaming.vivarobet.am') {
          $window.location = "//www.vivarobet.am/";
        } else {
          var hostName = Config.main.domainSpecificPrefixes[$window.location.hostname][path] || Config.main.domainSpecificPrefixes[$window.location.hostname][path.slice(0, -1)] || Config.main.domainSpecificPrefixes[$window.location.hostname][path + '/'];
          if (hostName) {
            routChangePromise();
            if (event) {
              event.preventDefault();
            }
            $window.location = hostName + $location.$$absUrl.substr($location.$$absUrl.indexOf('#/'));
          }
        }
      }
    }

    if (!Utils.isObjectEmpty(Config.main.domainSpecificPrefixes)) {
      routChangePromise = $scope.$on('$routeChangeStart', function(event, next) {
        if (next.$$route) {
          var nextPath = '#' + next.$$route.originalPath;
          domainSpecificCheck(nextPath, event);
        }
      });

      domainSpecificCheck('#' + $location.path()); //initial state
    }

    /**
     * @ngdoc method
     * @name loginTermsCheck
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Check if terms has been changed after login
     */
    function loginTermsCheck() {
      if (Config.main.registration.termsUpdateConfirmation && $rootScope.profile) {

        var verifyTerms = function (termsData) {
          if (termsData && termsData.version && ($rootScope.profile.terms_and_conditions_version || '').toString() !== termsData.version.toString()) {

            $rootScope.$broadcast("globalDialogs.addDialog", {
              type: 'terms-dialog',
              title: 'Terms &amp; Conditions',
              content: '<a>Please note that our {1} have been revised.<br>To proceed you must confirm that you agree to the changes in our {1}. Click below to agree</a>',
              scrollContent: termsData.content,
              contentPlaceholders: ['<i>' + Translator.get('Terms &amp; Conditions') + '</i>'],
              hideCloseButton: true,
              buttons: [
                {
                  title: 'I have read & Accept',
                  callback: function () {
                    Zergling.get({version: termsData.version.toString()}, 'terms_and_conditions_version_acceptance').then(function (response) {
                      console.log('Terms Response', response);
                    });
                  }
                },
                {
                  title: 'I do not Accept',
                  callback: function () {
                    $rootScope.$broadcast('doLogOut');
                  }
                }
              ]
            });
          }
        };

        var terms;

        if ($rootScope.helpPages) {
          terms = Utils.getItemBySubItemProperty($rootScope.helpPages, 'slug', ['general-terms-and-conditions']);
        }

        if (terms) {
          verifyTerms(terms['general-terms-and-conditions']);
        } else {
          content.getTermsAndConditions().then(function (data) {
            if (data && data.data && data.data.page) {
              verifyTerms(data.data.page);
            }
          });
        }
      }
    }

    /**
     * @ngdoc method
     * @name loadPasswordRules
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Load password rules from registration config
     */
    function loadPasswordRules() {
      var passwordContainingObject;
      $rootScope.passwordRules = {};
      if (Config.dialog && Config.dialog['regframe']) {
        return;
      }
      if (Config.main.registration.simplified) {
        if (RegConfig.step1.leftCol !== undefined) {
          passwordContainingObject = RegConfig.step1.leftCol.concat(RegConfig.step1.rightCol || []);
        } else {
          passwordContainingObject = RegConfig.step1;
        }
      } else {
        passwordContainingObject = RegConfig.leftCol.concat(RegConfig.rightCol || []);
      }
      var passwordContainingObjectLength = passwordContainingObject.length;
      for(var i = 0; i < passwordContainingObjectLength; ++i) {
        var field = passwordContainingObject[i];
        if (field.name === "password") {
          $rootScope.passwordRules["placeholder"] = field.placeholder;
          var customAttrsLength =  field.customAttrs.length;
          for(var j = 0; j < customAttrsLength; ++j){
            var attribute = field.customAttrs[j];
            for(var key in attribute){
              if (attribute.hasOwnProperty(key)){
                $rootScope.passwordRules[key] = attribute[key];
                break;
              }
            }
          }
          $rootScope.passwordRules.validationMessages = field.validation;
          break;
        }
      }
      var pattern = $rootScope.passwordRules['ng-pattern'];
      if (pattern !== undefined && pattern.charAt(0) === '/') {
        pattern = pattern.substr(1, pattern.length - 2);
        $rootScope.passwordRules['ng-pattern'] = pattern;
      }
    }

    //Chrome extension check
    if (window.chrome && window.chrome.app && !window.chrome.app.isInstalled) {
      $scope.showChromeExtensionButton = true;
    }

    partner.call('applicationReady');

    window.displayEventLimit = function displatEventLimit(event) {
      if (!Config.main.displayEventsMaxBet || !Config.env.authorized) {
        return;
      }
      var callback, gameEvent = {
        id: event.target.dataset.id
      };
   //   event.target.dataset.title = $filter('currency')($rootScope.profile.currency_name);
      callback = function () {
        event.target.dataset.title = gameEvent.maxBet + " " + $filter('currency')($rootScope.profile.currency_name);
      };

      GameInfo.displayEventLimit(gameEvent, callback);
    };

    window.cancelDisplayEventLimit = function displatEventLimit(event) {
      if (!Config.main.displayEventsMaxBet || !Config.env.authorized) {
        return;
      }
      var callback, gameEvent;
      gameEvent = {
        id: event.target.dataset.id
      };
      callback = function () {
        event.target.dataset.title = "";
      };
      GameInfo.cancelDisplayEventLimit(gameEvent, callback);
    };

    /*login limit functionality implementation*/
    var loginLimitWatcherPromise, loginLimitChangePromise;

    /**
     * @ngdoc method
     * @name cancelLoginLimitWatching
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Remove the session watching timer
     */
    function cancelLoginLimitWatching() {
      if (loginLimitWatcherPromise) {
        $timeout.cancel(loginLimitWatcherPromise);
        loginLimitWatcherPromise = undefined;
      }
    }

    /**
     * @ngdoc method
     * @name startLoginTimeWatching
     * @methodOf vbet5.controller:mainHeaderCtrl
     * @description Start watching user logging time
     */
    function startLoginTimeWatching(duration) {
      cancelLoginLimitWatching();
      if (duration) {
        loginLimitWatcherPromise = $timeout(function() {
          $rootScope.$broadcast("globalDialogs.addDialog", {
            type: 'limit',
            title: 'Login Limit',
            subTitle: Translator.get('Time as logged in') + '<br>' + $scope.env.loginTime,
            tag: 'authorized',
            content: 'login-limit-reminder-text',
            hideCloseButton: true,
            buttons: [
              {title: 'Log out', callback: function () {
                  logOutUser(false);
                }},
              {title: 'Continue', callback: function () {
                  startLoginTimeWatching($rootScope.profile.session_duration);
                }},
              {title: 'Balance history', callback: function () {
                  $scope.toggleSliderTab('balanceHistory', '', true);
                  startLoginTimeWatching($rootScope.profile.session_duration);
                }}
            ]
          });
        }, duration * 60 * 1000);
      }
    }

    function loginLimitCheck() {
      if (Config.main.loginLimit.enabled) {
        loginLimitChangePromise = $scope.$on('loginLimit.change', function(event, duration) {
          if(duration.value || duration.value === 0) {
            Zergling.get({"session_duration": duration.value}, 'set_session_duration').then(function () {
              $rootScope.profile.session_duration = duration.value;
              startLoginTimeWatching(duration.value);

              $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'success',
                title: 'Success',
                content: 'Your Login time settings have been updated.'
              });
            });
          }
        });

        startLoginTimeWatching($rootScope.profile.session_duration);
      }
    }

    function disableLoginLimitChecking() {
      if (Config.main.loginLimit.enabled) {
        if (loginLimitChangePromise) {
          loginLimitChangePromise();
        }
        cancelLoginLimitWatching();
      }
    }

    /* end of login limit functionality implementation*/


    function restartTimingStrategy(isLoggedIn) {
      if (Config.main.showLoginTimer) {
        $interval.cancel(timingStrategyPromise);
        if (isLoggedIn) {
          lastLoggedInDate = $rootScope.profile.last_login_date? $rootScope.profile.last_login_date * 1000 : Date.now();
          timingStrategyPromise = $interval(clockWithLoggedInTime, 1000);
        } else {
          timingStrategyPromise = $interval(clock, 1000);
          $scope.env.loginTime = 0;
        }
      }
    }

    function doLoginActions() {
      performDeepLinkedAction();
      getAllowedPaymentSystems();
      checkAndAddUserReport();
      watchAuthData();
      loginTermsCheck();
      loginLimitCheck();
      restartTimingStrategy(true);
      TopMenu.refresh();
      partner.call('loggedIn');
      $rootScope.$broadcast('globalDialogs.removeDialogsByTag', 'rfid');

      Config.main.domainSpecificPrefixes &&  domainSpecificCheck('#' + $location.path());
    }

    function doLogoutAction() {
      TopMenu.refresh();
      liveChat.liveAgentProfileClear && liveChat.liveAgentProfileClear();
      disableLoginLimitChecking();
      restartTimingStrategy(false);
      $rootScope.$broadcast('globalDialogs.removeDialogsByTag', 'authorized');
    }

    // login
    $scope.$on('loggedIn', doLoginActions);

    $scope.$on('login.loggedOut', doLogoutAction);
    $scope.$on('loggedOut', function () {
      partner.call('loggedOut');
      doLogoutAction();

    });     // logged out
  }]);

