/**
 * @ngdoc controller
 * @name CASINO.controller:providerJackpotCtrl
 * @description
 * provider jackpot page controller
 */

CASINO.controller('providerJackpotCtrl', ['$rootScope', '$scope', 'Config', 'CConfig', 'Zergling', 'casinoData', 'Utils', 'casinoManager', 'Translator', '$interval', 'TimeoutWrapper', 'analytics', 'content', 'casinoMultiviewValues', 'jackpotManager', '$location', "$controller", "Geoip",function ($rootScope, $scope, Config, CConfig, Zergling, casinoData, Utils, casinoManager, Translator, $interval, TimeoutWrapper, analytics, content, casinoMultiviewValues, jackpotManager, $location, $controller,Geoip) {
    'use strict';

    $scope.widgetMode = $location.path() !== '/jackpots/';

    if (!CConfig.disableAutoLoadMore) {
        $rootScope.footerMovable = true;
    }

    if(!$scope.widgetMode){
        $scope.confData = CConfig;
        $scope.slideIndex = 0;
        $scope.gamesInfo = [];
        $scope.viewCount = 1;
        $scope.hasTournaments = $rootScope.conf.multiLevelMenu.hasOwnProperty('tournaments');
        $scope.$on('widescreen.on', function () { $scope.wideMode = true; });
        $scope.$on('widescreen.off', function () { $scope.wideMode = false; });
        $scope.$on('middlescreen.on', function () { $scope.middleMode = true; });
        $scope.$on('middlescreen.off', function () { $scope.middleMode = false; });

        $scope.jackpotWidgets = {
            widgetIndex: 0
        };
        $scope.tab = {selected: 'tournaments'};

        $scope.changeJackpotSlider = function (index) {
            $scope.jackpotWidgets.widgetIndex = index < 0 ? $scope.jackpotData.length - 1 : index > $scope.jackpotData.length - 1 ? 0 : index;
        };
        casinoMultiviewValues.init($scope);

        /**
         * @description change view for applying functionality of multiple view in casino
         */

        $scope.$on('casinoMultiview.viewChange', function (event, view) {
            casinoManager.changeView($scope, view);
        });


        /**
         * @ngdoc method
         * @name enableToAddGame
         * @methodOf CASINO.controller:casinoCtrl
         * @description enable current view for add new game and show container of all games
         * @param {String} id gameInfo id
         */

        $scope.enableToAddGame = function enableToAddGame(id) {
            for (var i = 0; i < $scope.gamesInfo.length; i += 1) {
                $scope.gamesInfo[i].toAdd = id === $scope.gamesInfo[i].id;
            }
            $scope.$broadcast('casinoMultiview.showGames', 'all'); // show multiview popup  with all games
        };


        /**
         * @ngdoc method
         * @name refreshGame
         * @methodOf CASINO.controller:casinoCtrl
         * @description find game by id in opened games and relaod it
         *
         * @param {Int} id the games id
         */
        $scope.refreshGame = function refreshGame(id) {
            casinoManager.refreshCasinoGame($scope, id);
        };

        /**
         * @ngdoc method
         * @name openGameInNewWindow
         * @methodOf CASINO.controller:casinoCtrl
         * @description  calculates the possible sizes of the popup window and opens casino game in there
         *
         * @param {string} id game id
         */
        $scope.openGameInNewWindow = function openGameInNewWindow(id) {
            casinoManager.openPopUpWindow($scope, id);
        };

        $scope.togglePlayForReal = function togglePlayForReal(gameInfo) {
            casinoManager.togglePlayMode($scope, gameInfo);
        };

        /**
         * @ngdoc method
         * @name openGame
         * @methodOf CASINO.controller:casinoCtrl
         * @param {Object} game game object
         * @param {String} gameType gameType string
         * @param {String} studio studio string
         * @param {String} urlSuffix the url's suffix
         * @param {Number} multiViewWindowIndex - passed when the window in multiview is refreshed
         * @description  opens login form if it needed, or generates casino game url and opens it
         */

        $scope.openGame = function openGame(game, gameType, studio, urlSuffix, multiViewWindowIndex) {
            var countries = CConfig.main.restrictProvidersInCountries;
            if (countries && countries[game.provider] && countries[game.provider].indexOf(countryCode) !== -1) {
                showPermittedMessage();

                return;
            }

            casinoManager.openCasinoGame($scope, game, gameType, studio, urlSuffix, multiViewWindowIndex);
        };

        // casino games list directive events
        $scope.$on('casinoGamesList.openGame', function (e, data) {
            if (!data.game && data.gameId) {
                casinoData.getGames(null, null, countryCode, null, null, null, null, [data.gameId]).then(function (response) {
                    if (response && response.data && response.data.games && response.data.games.length) {
                        $scope.openGame(response.data.games[0]);
                    }
                });
            } else {
                $scope.openGame(data.game, data.playMode, data.studio);
            }
        });

        /**
         * @ngdoc method
         * @name closeGame
         * @methodOf CASINO.controller:casinoCtrl
         * @description  close opened game
         */
        $scope.closeGame = function closeGame(id) {
            casinoManager.closeGame($scope, id);
        };

        /**
         * @ngdoc method
         * @name toggleSaveToMyCasinoGames
         * @methodOf CASINO.controller:casinoCtrl
         * @description send events for adds or removes(depending on if it's already there) game from 'my casino games'
         * @param {Object} game Object
         */
        $scope.toggleSaveToMyCasinoGames = function toggleSaveToMyCasinoGames(game) {
            casinoManager.toggleSaveToMyCasinoGames($rootScope, game);
        };
    }



    $scope.providersToShow = $scope.widgetMode ?  5 : 7;
    $scope.providerJackpotGamesLimits = {};
    $scope.providerJackpotGames = {};

    $scope.loadingJackpotesProcess = {};
    $scope.transform = true;

    $scope.providerChangeCallback = function providerChangeCallback(provider) {

        $scope.selectedProvider = provider;
        if (!$scope.widgetMode) {
            $location.search('provider', $scope.selectedProvider);
        }
        if (!$scope.providerJackpotGames[$scope.selectedProvider].length) {
            $scope.getProviderJackpotGames();
        }
        $scope.loadMoreGames();
    };

    /**
     * @ngdoc method
     * @name loadMoreGames
     * @methodOf CASINO.controller:casinoCtrl
     * @description  Increases number of recent games to show
     */
    $scope.loadMoreGames = function loadMoreGames() {
        if ($scope.loadingJackpotesProcess[$scope.selectedProvider]) {
            return;
        }

        $scope.providerJackpotGamesLimits[$scope.selectedProvider].offset = $scope.wideMode ? CConfig.main.increaseByWide : CConfig.main.increaseBy;

        if ($scope.providerJackpotGamesLimits[$scope.selectedProvider] && $scope.providerJackpotGamesLimits[$scope.selectedProvider].from + $scope.providerJackpotGamesLimits[$scope.selectedProvider].offset < $scope.providerJackpotGamesLimits[$scope.selectedProvider].max && !$scope.gamesInfo.length) {
            $scope.providerJackpotGamesLimits[$scope.selectedProvider].from += $scope.providerJackpotGamesLimits[$scope.selectedProvider].offset;
            $scope.getProviderJackpotGames();
        }
    };

    $scope.getProviderJackpotGames = function getProviderJackpotGames() {

        if ($scope.loadingJackpotesProcess[$scope.selectedProvider]) {
            return;
        }
        $scope.loadingJackpotesProcess[$scope.selectedProvider] = true;
        casinoData.getJackpotGames(null, $scope.selectedProvider, $scope.providerJackpotGamesLimits[$scope.selectedProvider].from, $scope.providerJackpotGamesLimits[$scope.selectedProvider].to).then(function (response) {
            if (response && response.data && response.data.status !== -1) {
                Array.prototype.push.apply($scope.providerJackpotGames[$scope.selectedProvider], response.data.items);
                $scope.providerJackpotGamesLimits[$scope.selectedProvider].max = parseInt(response.data.total_count, 10);
            }

        })['finally'](function () {
            $scope.loadingJackpotesProcess[$scope.selectedProvider] = false;
        });

    };

    function subscribeForJackpotData() {
        if (CConfig.version === 2 && ($rootScope.casinoGameOpened === 0 || $rootScope.casinoGameOpened === undefined)) {
            jackpotManager.subscribeForExternalJackpotData(subscribeForExternalJackpotDataCallback);
        }
    }

    $scope.externalJackpotData = [];
    var jackpotsCount = 0;

    function subscribeForExternalJackpotDataCallback(data) {

        $scope.externalJackpotData = Utils.objectToArray(data).filter(function (t) {
            return t
        }); // filtering empties


        if (jackpotsCount !== $scope.externalJackpotData.length) {
            $scope.externalJackpotProviders = $scope.externalJackpotData.map(function (jackpot) {
                return {
                    name: jackpot.Provider
                }
            });
        }

        jackpotsCount = $scope.externalJackpotData.length;

        $scope.externalJackpotData.forEach(function (jackpot) { // sorting pools by amount
            jackpot.PoolGroup.PoolList.sort(function (a, b) {
                return b.CollectedAmount - a.CollectedAmount;
            });


            if (!$scope.providerJackpotGames[jackpot.Provider]) {
                $scope.providerJackpotGames[jackpot.Provider] = [];
            }
            if (!$scope.loadingJackpotesProcess[jackpot.Provider]) {
                $scope.loadingJackpotesProcess[jackpot.Provider] = false;
            }

            if (!$scope.providerJackpotGamesLimits[jackpot.Provider]) {
                $scope.providerJackpotGamesLimits[jackpot.Provider] = {
                    from: 0,
                    to: $scope.widgetMode ? 4 : 30,
                    max: 0
                };
            }
        });

        if ($scope.selectedProvider && $scope.externalJackpotData.length > 0 && $scope.providerJackpotGames[$scope.selectedProvider] && !$scope.providerJackpotGames[$scope.selectedProvider].length) {
            $scope.getProviderJackpotGames();
        }
    }

    $scope.backgrounds = {};

    function getProvidersBanners() {
        casinoData.getJackpotBanners().then(function (response) {
            if (response && response.data && response.data.items.length) {
                response.data.items.forEach(function (item) {
                    $scope.backgrounds[item.slug.toUpperCase()] = {
                        image : item.thumbnail,
                        textColor : item.custom_fields && item.custom_fields['text-color'] && item.custom_fields['text-color'][0],
                        backgroundColor : item.custom_fields && item.custom_fields['background-color'] && item.custom_fields['background-color'][0]
                    };

                });

            }
        })['finally'](function () {

        });
    }


    /**
     * @name findAndOpenGame
     * @param games games array
     * @description get gameId from $location, find game in games and open it
     */
    function findAndOpenGame(searchParams) {
        if (searchParams.game !== undefined) {
            var game;
            casinoData.getGames(null, null, countryCode, null, null, null, null, [searchParams.game]).then(function (response) {
                game = response && response.data && response.data.games[0];
                if (game !== undefined) {
                    var gameType, initialType = searchParams.type || ($rootScope.env.authorized ? 'real' : 'fun');
                    switch (initialType) {
                        case "demo":
                        case "fun":
                            gameType = $rootScope.env.authorized && game.types.viewMode ? "real" : "fun";
                            $scope.openGame(game, gameType);
                            break;
                        case "real":
                            if ($rootScope.env.authorized) {
                                $scope.openGame(game, "real");
                            } else {
                                if (!$rootScope.loginInProgress) {
                                    $rootScope.$broadcast('openLoginForm');
                                } else {
                                    var gameInfo = {};
                                    gameInfo.gameID = game.front_game_id;
                                    gameInfo.game = game;
                                    gameInfo.loadingUserData = true;
                                    $rootScope.casinoGameOpened = 1;
                                    $scope.gamesInfo.push(gameInfo);

                                    var loginProccesWatcher = $scope.$watch('loginInProgress', function () {
                                        if (!$rootScope.loginInProgress) {
                                            loginProccesWatcher();
                                            if (!$rootScope.env.authorized) {
                                                $scope.closeGame();
                                                $rootScope.$broadcast("openLoginForm");
                                            } else {
                                                $scope.openGame(game, "real");
                                            }
                                        }
                                    })
                                }
                            }
                            break;
                        default:
                            $scope.openGame(game, gameType);
                    }
                }
            });
        }
    }
    var countryCode = '';

    (function init() {
        var searchParams = $location.search();
        getProvidersBanners();
        subscribeForJackpotData();
        findAndOpenGame(searchParams);
        $scope.selectedProvider = !$scope.widgetMode && searchParams.provider ? searchParams.provider : Config.main.jackpot.casino.externalJackpotsDefaultProvider;

        Geoip.getGeoData(false).then(function (data) {
            data && data.countryCode && (countryCode = data.countryCode);
        })['finally'](function () {
        });


    })();

    $scope.$on('$destroy', function () {
        jackpotManager.unsubscribeFromAllExternalJackpotData();
    });

}]);