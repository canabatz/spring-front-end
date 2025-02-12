/* global BettingModule */
/*jshint -W024 */
/**
 * @ngdoc controller
 * @name betting.controller:betSlipController
 * @usage dsa
 * @description
 * Explorer controller
 */
BettingModule.controller('betSlipController', ['$q', '$scope', '$rootScope', '$filter', 'Config', 'Zergling', 'Storage', 'Translator', '$location', '$route', '$window', '$injector', 'analytics', 'DomHelper', 'Utils', 'partner', 'TimeoutWrapper', 'UserAgent', '$timeout', 'BetService', 'BetIntelligent', 'Moment', function ($q, $scope, $rootScope, $filter, Config, Zergling, Storage, Translator, $location, $route, $window, $injector, analytics, DomHelper, Utils, partner, TimeoutWrapper, UserAgent, $timeout, BetService, BetIntelligent, Moment) {
    'use strict';

    TimeoutWrapper = TimeoutWrapper($scope);
    var betslipSubscriptionProgress = null; // couldn't come up with a good name for this :/
    var addBetInProgress = false;
    var subscribePromise, freebetPromise, promiseTimer = 300;
    var finalWinValue;

    var addGameToFavorites = function (game) {
        if (!$rootScope.conf.addToFavouritesOnBet) return;

        $rootScope.$broadcast('game.addToMyGames', game);
    };

    var ODD_TYPE_MAP = {
        'decimal': 0,
        'fractional': 1,
        'american': 2,
        'hongkong': 3,
        'malay': 4,
        'indo': 5
    };

    $rootScope.superbetIds = {
        counterOffers : [],
        superBets : []
    };

    $scope.betConf = Config.betting;
    $scope.enableSigninRegisterLinks =  Config.partner.enableSigninRegisterCallbacks;
    $scope.sportsbookAvailableViews = Utils.checkForAvailableSportsbookViews(Config);
    $scope.displayQuickBet = false;

    $scope.shared = { // Object used for sharing data between directives/controllers
        showBetSettings: $scope.betConf.enableShowBetSettings,
        isBetsInProgress: false, // Used for quick bet
        betInProgress: false // Used for usual bet
    };
    $scope.bonusBet = {
        enabled: false
    };
    $scope.freeBet = {
        enabled: false
    };
    $scope.profitBoost = {
        enabled: false
    };
    $scope.counterOffer = {
        enabled: false
    };

    $scope.eventReplace = {
        visibilityProcess: false,
        visibilityTime: 2000
    };

    if (Config.main.enableBetPrint) {
        $scope.betPrint = BetService.print.state;

        $scope.printLastBet = function printLastBet() {
            if ($scope.betPrint.id) {
                $scope.betPrint.inProgress = true;
                BetService.getBetHistory($scope.betPrint.id )
                    .then(BetService.print.openPrintPreview)
                    .finally(function() { $scope.betPrint.inProgress = false; });
            }
        };
    }

    var eventReplaceMessageVisibilatyPromise;

    $scope.fullCoverBet = {
        enabled: Config.betting.fullCoverBetTypes.enabled,
        expanded: Config.betting.fullCoverBetTypes.expanded || false, // make colapsed by default
        types: {}
    };

    $scope.taxOnStake = {
        enabled: false
    };

    var fullCoverTypesMap = {
        1: "Singles",
        2: "Doubles",
        3: "Trebles",
        'default': "Folds"
    };

    var fullCoverAdditionalTypesMap = {
        3: [
            {
                name: "Trixie",
                type: 5
            },
            {
                name: "Patent",
                type: 12,
                includeSingles: true
            }
        ],
        4: [
            {
                name: "Yankee",
                type: 6
            },
            {
                name: "Lucky 15",
                type: 14,
                includeSingles: true
            }
        ],
        5: [
            {
                name: "Super Yankee",
                type: 8
            },
            {
                name: "Lucky 31",
                type: 15,
                includeSingles: true
            }
        ],
        6: [
            {
                name: "Heinz",
                type: 9
            },
            {
                name: "Lucky 63",
                type: 16,
                includeSingles: true
            }
        ],
        7: [
            {
                name: "Super Heinz",
                type: 10
            }
        ],
        8: [
            {
                name: "Goliath",
                type: 11
            }
        ]
    };


    var mathCuttingFunction = Utils.mathCuttingFunction;//Config.main.decimalFormatRemove3Digit ? Math.floor : Math.round;

    var isPlaceBetsAfterAcceptChanges = false;




    /**
     * @ngdoc object
     * @name calculateQuickBetVisibility
     * @methodOf betting.controller:betSlipController
     * @description Detects if quickbet should be visible based on scope and url data
     */
    function calculateQuickBetVisibility () {
        $scope.displayQuickBet = $scope.env.authorized
            && $scope.betConf.quickBet.enableQuickBetStakes
            && $scope.quickBet.enabled
            && $scope.betConf.quickBet.visibleForPaths.indexOf($location.path().split('/')[1]) > -1;
    }
    /**
     * @ngdoc object
     * @name getBetTitle
     * @methodOf betting.controller:betSlipController
     * @description Renders bet title and flips team1 and team2 names based on the language
     */
    function getBetTitle (game) {
        return game.team1_name + (game.team2_name ? ' - ' + game.team2_name : '');
    }

    /**
     * @ngdoc object
     * @name sysBetSelectedValue
     * @methodOf betting.controller:betSlipController
     * @description System Bet selected value
     */
    $scope.sysBetSelectedValue = 2;

    /**
     * @ngdoc object
     * @name acceptPriceChanges
     * @methodOf betting.controller:betSlipController
     * @description indicates if event price changes after adding to betslip are ok for user
     */

    if (Storage.get('autoAcceptSettings')) {
        $scope.shared.acceptPriceChanges = Storage.get('autoAcceptSettings');
    } else if (Config.betting.defaultPriceChangeSetting) {
        $scope.shared.acceptPriceChanges = Config.betting.defaultPriceChangeSetting + '';
    } else {
        $scope.shared.acceptPriceChanges = '0';
    }


    /**
     * @ngdoc object
     * @name isBetAccepted
     * @methodOf betting.controller:betSlipController
     * @description indicates if current bet is accepted
     */

    $scope.isBetAccepted = false;

    /**
     * @ngdoc object
     * @name quickBet
     * @methodOf betting.controller:betSlipController
     * @description Quick Bet Result
     */
    $scope.quickBet = {
        status: 'idle',
        enabled: false,
        massage: "",
        showTimer: {}
    };

    var betAcceptedWatcherPromise, showQuickBetWatcherPromise;

    /**
     * @ngdoc method
     * @name betEventsToRootScope
     * @methodOf betting.controller:betSlipController
     * @description places all event ids from betslip to 'betEvents' object in $rootScope.
     * Needed for showing selected event in game view
     */
    function betEventsToRootScope() {
        $rootScope.betEvents = {};
        $scope.betSlip.bets.map(function (bet) {
            $rootScope.betEvents[bet.eventId] = {selected: true, oddType: bet.oddType};
        });
        if ($scope.betSlip.bets.length !== 1 || $scope.betSlip.type.value !== 1) {
            $scope.betSlip.betterOddSelectionMode = false;
        }
    }

    $scope.$watch('betSlip.bets', betEventsToRootScope, true);
    $scope.$watch('shared.acceptPriceChanges', function () {
        Storage.set('autoAcceptSettings', $scope.shared.acceptPriceChanges);
        $scope.thereIsPriceChange();
    }, true);

    if ($rootScope.conf.sportsLayout === 'combo') { /*implemented for obly combo view*/
        $scope.$watch('quickBet.enabled', function () {
            calculateQuickBetVisibility();
        });
    }

    $scope.$watchCollection('[betSlip.stake, betSlip.unitStake, betSlip.divisionCoefficient]', function (newStakes, oldStakes) {

        if ($scope.betConf.roundBetCents) {
            $scope.betSlip.stake = Math.floor($scope.betSlip.stake);
        }

        if ((!newStakes[0] && !!oldStakes[0]) || (!newStakes[1] && !!oldStakes[1])) {
            if (newStakes[0] === undefined || newStakes[1] === undefined) {
                $scope.betSlip.stake = $scope.betSlip.unitStake = undefined;
            } else {
                $scope.betSlip.stake = $scope.betSlip.unitStake = 0;
            }
        } else {
            if (newStakes[0] !== oldStakes[0] && $scope.betSlip.type.value !== 3) {
                $scope.betSlip.unitStake = $scope.betSlip.stake / $scope.betSlip.divisionCoefficient;
            } else {
                if (!!$scope.betSlip.unitStake && $scope.betSlip.bets.length > 2) {
                    $scope.betSlip.stake = Math.round($scope.betSlip.divisionCoefficient * $scope.betSlip.unitStake * 100) / 100;
                }
            }
        }

    });


    /**
     * Subscription id
     *
     * @type {number}
     */
    var subId = null;
    var exchangeSubId = null;


    /**
     * Copy betType list from config to scope
     * @type {.main.betTypes|*|Array|.main.betTypes|*}
     */
    $scope.betTypes = Config.main.betTypes || [];
    /**
     * @ngdoc method
     * @name calcBetterOdd
     * @methodOf betting.controller:betSlipController
     * @description calculates the better price
     *
     * @param {Object} price
     */
    function calcBetterOdd (price) {
        price = parseFloat(price, 10);
        if (price < 1.06) {
            return price;
        }

        price = (price - 1) * 0.1 + price;
        if(price > 10) {
            price = Math.ceil(price);
        } else {
            price = +price.toFixed(2);
        }
        return price;
    }

    /**
     * @ngdoc method
     * @name hideBetProcessLoaders
     * @methodOf betting.controller:betSlipController
     * @description hide all loaders
     *
     */
    function hideBetProcessLoaders () {
        $scope.shared.betInProgress = false;
        $scope.shared.isBetsInProgress = false;
        if ($scope.betSlip && $scope.betSlip.bets) {
            angular.forEach($scope.betSlip.bets, function (bet) {
                bet.processing = false;
            });
        }
    }

    /**
     * @ngdoc method
     * @name updateEventWithAnother
     * @methodOf betting.controller:betSlipController
     * @description replaces the event id of provided event with another from same type of market with nearest base
     * then updates betslip subscription after which corresponding bet in betslip gets news event's properties
     *
     * @param {Object} originalEvent betslip event that ned to be replaced
     * @param {Object} data swarm response object (requested events from same game with same market and  event type)
     */
    function updateEventWithAnother(originalEvent, data) {
        var events = [], minBaseDifference, selectedIndex;
        angular.forEach(data.data.market, function (market) {
            angular.forEach(market.event, function (event) {
                events.push({id: event.id, base: event.base || market.base});
            });
        });

        events.map(function (event, index) {
            if (event.base) {
                var diff = Math.abs(event.base - originalEvent.baseInitial);
                if (minBaseDifference === undefined || diff < minBaseDifference) {
                    minBaseDifference = diff;
                    selectedIndex = index;
                }
            }
        });
        if (selectedIndex !== undefined && events[selectedIndex]) {

            originalEvent.eventId = events[selectedIndex].id;
            originalEvent.deleted = false;
            updateBetslipSubscription();
        } else {
            originalEvent.deleted = true;
        }
    }


    /**
     * @ngdoc method
     * @name updateEventPrices
     * @methodOf betting.controller:betSlipController
     * @description updates event prices in betslip according to update received from subsciption and marks deleted events
     * @param {object} data data from swarm
     */
    function updateEventPrices(data) {
        $scope.betSlip.thereAreDeletedEvents = false;
        $scope.betSlip.thereAreEventBaseChanges = false;
        angular.forEach($scope.betSlip.bets, function (b) {
            b.deleted = true;
            angular.forEach(data.game, function (game) {
                angular.forEach(game.market, function (market) {
                    angular.forEach(market.event, function (event) {
                        if(Config.main.showPlayerRegion){
                            game.team1_name = game.team1_reg_name && game.team1_name.indexOf(game.team1_reg_name) === -1 ? game.team1_name + ' (' + game.team1_reg_name + ')' : game.team1_name;
                            game.team2_name = game.team2_reg_name && game.team2_name.indexOf(game.team2_reg_name) === -1 ? game.team2_name + ' (' + game.team2_reg_name + ')' : game.team2_name;
                        }
                        if (b.eventId === event.id) {
                            b.deleted = false;
                            b.priceChange = event.price_change;
                            b.price = event.price;
                            b.betterPrice = calcBetterOdd (event.price);
                            b.base = event.base || market.base;
                            b.blocked = (game.is_blocked || ($filter('oddConvert')(event.price, 'decimal')) == 1);
                            b.title = (game.displayTitle ?  game.displayTitle + " " : "") + getBetTitle(game);
                            b.marketName = $filter('improveName')(market.name, game);
                            b.team1Name = game.team1_name;
                            b.team2Name = game.team2_name;
                            b.gamePointer.isLive = game.is_live;
                            b.marketHomeScore = market.home_score;
                            b.marketAwayScore = market.away_score;
                            b.eventType1 = event.type_1;
                            b.hasCashout = market.cashout;

                            event.name = $filter('removeParts')(event.name, [market.name]);
                            if (Config.main.dontReplaceP1P2WithTeamNamesForEvents) {
                                if (!Config.main.dontReplaceP1P2WithTeamNamesForEvents[market.type]) {
                                    event.name = $filter('improveName')(event.name, game);
                                }
                            }
                            else if (Config.main.replaceP1P2WithTeamNames) {
                                event.name = $filter('improveName')(event.name, game);
                            }
                            b.pick = event.name;
                        }
                    });
                });
            });
            if (b.deleted && b.base !== undefined && !$scope.shared.isBetsInProgress && b.gamePointer && Config.main.enableBSEventReplacingForSports.indexOf(b.gamePointer.sport) !== -1) {  // try to replace it with another from same game with same market and event type
                b.deleted = false;
                var request = {
                    'source': 'betting',
                    'what': {
                        'market': ['base', 'home_score', 'away_score'],
                        'event': ['id', 'base', 'type_1']
                    },
                    'where': {
                        'game': {'id': b.gameId},
                        'market': {'type': b.marketType}
                    }
                };
                request.where.event = b.eventType ? {'type': b.eventType} : {'type_1': b.eventType1};

                Zergling
                    .get(request)
                    .then(function (data) {updateEventWithAnother(b, data); });
            }
            if (b.baseInitial !== b.base && $scope.shared.acceptPriceChanges !== '2') {
                $scope.betSlip.thereAreEventBaseChanges = true;
            }
            if (b.deleted && !b.blocked) {
                $scope.betSlip.thereAreDeletedEvents = true;
            }
        });
        $scope.thereIsPriceChange();

        if (isPlaceBetsAfterAcceptChanges) {
            isPlaceBetsAfterAcceptChanges = false;
            placeBet();
        }
        //$scope.shared.showBetSettings = $scope.thereIsPriceChange(); //temporarily disable show bets settings on price change
    }

    /**
     * @ngdoc method
     * @name broadcastBetslipState
     * @methodOf betting.controller:betSlipController
     * @description broadcasts betslip state ('betslip.isEmpty' if theree are no events and 'betslip.hasEvents' if it has)
     */
    function broadcastBetslipState() {
        $rootScope.betSlipBetsCount = $scope.betSlip.bets.length;
        if ($scope.betSlip.bets.length === 0) {
            $rootScope.$broadcast('betslip.isEmpty', $scope.betSlip.bets.length);
        } else {
            $rootScope.$broadcast('betslip.hasEvents', $scope.betSlip.bets.length);
        }
    }

    /**
     * @ngdoc method
     * @name subscribeToBetslipEvents
     * @methodOf betting.controller:betSlipController
     * @description subscribes to events which are in betslip.
     * When subscription is done resolves **betslipSubscriptionProgress** promise with subscription id
     */
    function subscribeToBetslipEvents() {

        var subscribingProgress = $q.defer();
        betslipSubscriptionProgress = subscribingProgress.promise;

        var eventIds = $scope.betSlip.bets.map(function (bet) {
            return bet.eventId;
        });
        var gameIds = $scope.betSlip.bets.map(function (bet) {
            return bet.gameId;
        });
        if (eventIds.length === 0) {
            console.log('no betslip events to subscribe');
            betslipSubscriptionProgress = null;
            return;
        }
        var request = {
            'source': 'betting',
            'what': {
                'game': ['id', 'is_blocked', 'team1_name', 'team2_name', 'team1_reg_name', 'team2_reg_name', 'is_live'],
                'market': ['base', 'type', 'name', 'home_score', 'away_score', 'cashout'],
                'event': ['id', 'price', 'type', 'type_1', 'name', 'base']
            },
            'where': {
                'game': {
                    'id': {'@in': gameIds}
                },
                'event': {
                    'id': {'@in': eventIds}
                }
            }
        };
        request.is_betslip = true;
        Zergling.subscribe(request, updateEventPrices).then(function (response) {
            subId = response.subid;
            subscribingProgress.resolve();
            updateEventPrices(response.data);
        });
    }

    /**
     * @ngdoc method
     * @name updateBetslipSubscription
     * @methodOf betting.controller:betSlipController
     * @description subscribes to event in betslip after unsubscribing from old subscription(if there's one)
     */
    function updateBetslipSubscription() {
        TimeoutWrapper.cancel(subscribePromise); // TimeoutWrapper checks the existence of promise by itself

        subscribePromise = TimeoutWrapper(function updateBetslipSubscriptionTimeout() {
            if (betslipSubscriptionProgress === null) { // first time
                subscribeToBetslipEvents();
            } else {
                betslipSubscriptionProgress.then(function() {
                    Zergling.unsubscribe(subId);
                    subId = undefined;
                    if (exchangeSubId) {
                        Zergling.unsubscribe(exchangeSubId);
                        exchangeSubId = null;
                    }
                    subscribeToBetslipEvents();
                });
            }
        }, promiseTimer);
    }
    /**
     * @ngdoc method
     * @name acceptChangesAndPlaceBets
     * @methodOf betting.controller:betSlipController
     * @description Cleans up BetSlip and place bets,
     * i.e. accepts all price changes and removes non-existing events from BetSlip
     */
    $scope.acceptChangesAndPlaceBets = function acceptChangesAndPlaceBets() {
        if ($scope.isTherePriceChange || $scope.thereAreEventBaseChanges){
            $scope.isAcceptAndPlaceBetStarted = true;
            // var newBets = [];
            angular.forEach($scope.betSlip.bets, function (b) {
                b.priceInitial = b.price;
                b.baseInitial = b.base;
                /*if (!b.deleted) {
                 newBets.push(b);
                 }*/
            });
            // $scope.betSlip.bets = newBets;
            Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
            isPlaceBetsAfterAcceptChanges = true;
            broadcastBetslipState();
            updateBetslipSubscription();
        } else {
            placeBet();
        }

    };

    /**
     * @ngdoc method
     * @name selectBetSlipMode
     * @methodOf betting.controller:betSlipController
     * @description selects bet slip tabs
     * @param {String} mode - betSlip.mode (the tab to which to switch to)
     * @param {MouseEvent} [event] - click event
     */
    $scope.selectBetSlipMode = function selectBetSlipMode(mode, event) {
        if (mode === 'auto' && event) {
            if (!event.target.dataset || !event.target.dataset.mode) { return; } // No 'data-mode' attribute on the HTML element
            event.stopPropagation();
            mode = event.target.dataset.mode;
        }

        if ($scope.betSlip.mode !== mode) {
            $scope.betSlip.mode = mode;
            $scope.isBetAccepted = false;

            //disable available options when betslip page tab changed
            disableFreeBet('freeBet');
            disableFreeBet('profitBoost');
            $scope.betSlip.superbet.selector = false;

            switch (mode) {
                case 'suggested':
                    if (event) {
                        $rootScope.$broadcast('suggestedBets.get', {type: 'live'});
                        analytics.gaSend('send', 'event', 'betting', 'suggestedBetsTabClick' + (Config.main.sportsLayout),  {'page': $location.path(), 'eventLabel': 'suggestedBetsTabClick'});
                    }
                    $scope.quickBet.enabled = false;
                    break;
                case 'openBets':
                    break;
                default: // betting & booking
                    Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
            }
        }
    };


    $scope.betSlip = Storage.get('betslip');

    if ($rootScope.editBet && $rootScope.editBet.edit && $scope.betSlip && $scope.betSlip.bets) {
        $timeout.cancel($rootScope.editBet.unsubPromise);
        $scope.disableAddBets = {};
        var betSlipLength = $scope.betSlip.bets.length;
        var i;
        if($rootScope.editBet.openSelectionsPart) {
            $scope.disableAddBets.newSelections = false;
            $scope.disableAddBets.saveChanges = true;
            $scope.disableAddBets.addBet = false;
            $scope.showInSelections = true;
            for(i = 0; i < betSlipLength; i++) {
                $scope.emptyNewSelections = !$scope.betSlip.bets[i].showInSelections;
            }
        } else {
            for(i = 0; i < betSlipLength; i++) {
                $scope.disableAddBets.saveChanges = $scope.betSlip.bets[i].showInSelections === undefined && !$rootScope.editBet.changed;
            }
            $scope.disableAddBets.newSelections = true;
            $scope.showInSelections = false;
            $scope.emptyNewSelections = true;
        }
    } else {
        $scope.showInSelections = false;   // if true => we should add events in new selections part of betSlip; if false => we'll add events as usual
        $scope.emptyNewSelections = true;  // if true => new selections part is empty
        $scope.disableAddBets = {
            newSelections: false,  // if true => disables 'Add selection' button
            addBet: false,         // if true => disables 'Add to bet' button
            saveChanges: true      // if true => disables 'Save changes' button
        };
    }


    if ($scope.betSlip === undefined || $scope.betSlip === null) {
        $scope.betSlip = {
            bets: [],
            generalBetResult: "",
            isBettingAllowed: true,
            sysValArray: [],
            stake: "",
            expOdds: "",
            sysOptions: "",
            type: $scope.betTypes[0],
            mode: 'betting',
            bookingResultIds: [],
            eachWayMode: false,
            divisionCoefficient: 1,
            superbet: {
                selector: $scope.shared.acceptPriceChanges === '-1',
                possible: true // If there's a virtual sport event in the bet slip superbet is turned off
            },
            counterOfferPossible: true // If there's a virtual sport event in the bet slip counter offer is turned off
        };
    } else {
        $scope.betSlip.bets.map(function (bet) {bet.processing = false; });//reset previous state if it remained for some raeason
        $scope.betSlip.stake = '';
        $scope.betSlip.unitStake = '';
        $scope.betSlip.generalBetResult = "";
        updateBetslipSubscription();
    }

    setTimeout(function () {
        (function setBetSlipMode() {
            if (!$rootScope.loginInProgress) {
                $scope.selectBetSlipMode(Config.main.enableBetBooking && (!$scope.betConf.enabled || !$rootScope.env.authorized) ? 'booking' : 'betting');
            } else {
                var loginProcessWatcher = $scope.$watch('loginInProgress', function(value) {
                    if (!value) {
                        loginProcessWatcher();
                        if ($scope.betSlip.mode !== 'betting' && $rootScope.env.authorized && $scope.betConf.enabled) {
                            $scope.selectBetSlipMode('betting');
                        }
                    }
                });
            }
        })();
    }, 1000);

    $timeout(broadcastBetslipState, 0); // Need to wait until sportNews ctrl is loaded

    //broadcast event about new type
    Config.main.disableOddFormatsSpecialCase && $rootScope.$broadcast('betslip.type', $scope.betSlip.type);

    /**
     * @ngdoc method
     * @name repeatSingleStake
     * @methodOf betting.controller:betSlipController
     * @param {String} betStake to repeat
     * @description repeat single stake for all single bets
     */
    $scope.repeatSingleStake = function repeatSingleStake(betStake) {
        if (!isNaN(betStake) && betStake > 0) {
            angular.forEach($scope.betSlip.bets, function (value) {
                value.singleStake = betStake;
            });
        }
    };

    /**
     * @ngdoc method
     * @name getMaxBet
     * @methodOf betting.controller:betSlipController
     * @param {Object} betEvents bet
     * @pstsm {Object} fullCoverType object
     * @description Get Maximum stake amount for selected event
     */
    $scope.getMaxBet = function getMaxBet(betEvents, fullCoverType) {
        var request = {
            'events': []
        };
        request.type = $scope.betSlip.type.value;
        var isArray = angular.isArray(betEvents);
        if (isArray) {
            angular.forEach(betEvents, function (betEvent) {
                request.events.push(betEvent.eventId);
            });
        } else {
            request.events.push(betEvents.eventId);
        }

        var processMaxBetResults = function (result) {
            var value = result.details.amount;
            var maxResult = Config.main.onlyDecimalStakeAmount ? Math.floor(value) : parseFloat(value);
            if (fullCoverType) {
                fullCoverType.amount = maxResult;
            } else if (isArray) {
                $scope.lustMaxBetResult = $scope.betSlip.stake = maxResult / ($scope.betSlip.eachWayMode ? 2 : 1);
            } else {
                betEvents.singleStake = maxResult / (betEvents.eachWay ? 2 : 1);
            }
        };

        //full cover type case
        if (fullCoverType) {
            fullCoverType.sysCount && (request.sys_min_count = fullCoverType.sysCount);
            request.type = fullCoverType.type;
        }

        Zergling
            .get(request, 'get_max_bet').then(processMaxBetResults)['catch'](function (reason) {
            console.log('Error:', reason);
        });
    };

    /**
     * @ngdoc method
     * @name removeBet
     * @methodOf betting.controller:betSlipController
     * @param {String} betToRemove bet object.  if field of object is used to find bet in betslip
     * @param {Boolean} skipStateUpdate. if true skiping some functionality
     * @description removes bet from betslip
     */
    $scope.removeBet = function removeBet(betToRemove, skipStateUpdate) {
        var i;

        angular.forEach($scope.betSlip.bets, function (bet) {
            for (i = bet.conflicts.length - 1; i >= 0; i--) {
                if (betToRemove.eventId === bet.conflicts[i].eventId) {
                    bet.conflicts.splice(i, 1);
                }
            }
        });

        for (i = $scope.betSlip.bets.length - 1; i >= 0; i--) {
            if ($scope.betSlip.bets[i].eventId === betToRemove.eventId) {
                $scope.betSlip.bets.splice(i, 1);
            }
        }

        if ($rootScope.editBet && $rootScope.editBet.edit) {
            var originalEventRemoved, newEventPresent;
            if ($rootScope.editBet.originalEventIds.indexOf(betToRemove.eventId) > -1 ) {
                originalEventRemoved = true;
            }
            if ($scope.betSlip && $scope.betSlip.bets) {
                var eventsNumberInNewSelection = 0;
                i = $scope.betSlip.bets.length;
                while (i--) {
                    if ($rootScope.editBet.openSelectionsPart && $scope.betSlip.bets[i].showInSelections) {
                        eventsNumberInNewSelection++;
                    }
                    // If there is even a single event that has been added during the edit bet process we enable 'Save Changes' button
                    if ($scope.betSlip.bets[i].addedFromEditBet) {
                        $scope.disableAddBets.saveChanges = false;
                        newEventPresent = true;
                        i = 0;
                    }
                }

                if ($rootScope.editBet.openSelectionsPart && eventsNumberInNewSelection === 0) { $scope.emptyNewSelections = true; }
            }

            $rootScope.editBet.changed = !!(originalEventRemoved || newEventPresent);
            $scope.disableAddBets.saveChanges = !($rootScope.editBet.changed || $rootScope.editBet.increaseStake.savedAmount);
        }

        angular.forEach($scope.betTypes, function(betType) {
            if (betType.value === 1) {
                if ($scope.betSlip.bets.length === 1 && $scope.betSlip.type.value === 2 || ($scope.betSlip.bets.length === 0)) {
                    $scope.setBetSlipType(1, false);
                    $scope.betSlip.eachWayMode = false;
                    $scope.betSlip.superbet.selector = false;
                }
            }
        });
        if (!skipStateUpdate) {
            $scope.betSlip.bets.length === 0 && Config.betting.resetAmountAfterBet && ($scope.betSlip.stake = undefined);

            $scope.betSlip.generalBetResult = "";
            $scope.betSlip.bookingResultIds = [];
            $scope.sysBetSelectedValue = 2;

            Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);

            updateBetslipSubscription();
            checkFreeBet();
            checkSuperBetAndCounterOffer();
            broadcastBetslipState();

            $scope.betSlip.bets.length === 0 && ($scope.betSlip.stake = undefined);
            $scope.lustMaxBetResult = undefined;
        }

        if (Config.betting.enableRetainSelectionAfterPlacment && $scope.betSlip.bets.length === 0) {
            $scope.showRetainsButtons = false;
        }

        $rootScope.$broadcast('betslip.removeBet', betToRemove);
    };

    $scope.$on('removeBet', function (event, data) { $scope.removeBet(data); });


    function cancelEditBet() {
        $rootScope.editBet.edit = false;
        $rootScope.editBet.oldBetId = 0;
        $scope.disableAddBets.addBet = false;
        if ($rootScope.editBet.cashOutSubId) {
            BetService.cashOut.unsubscribe($rootScope.editBet.cashOutSubId);
            $rootScope.editBet.cashOutSubId = null;
        }
    }


    /**
     * @ngdoc method
     * @name clearBetslip
     * @methodOf betting.controller:betSlipController
     * @description removes all bet from betslip
     */

    $scope.clearBetslip = function clearBetslip(cancelEditMode) {
        $scope.betSlip.bets.length = 0;
        $scope.betSlip.generalBetResult = "";
        $scope.betSlip.bookingResultIds = [];
        $scope.sysBetSelectedValue = 2;
        $scope.betSlip.stake = '';
        $scope.betSlip.eachWayMode = false;
        $scope.betSlip.superbet.selector = false;
        $scope.betSlip.superbet.possible = true;
        if ($scope.shared.acceptPriceChanges === '-1') {
            $scope.shared.acceptPriceChanges = '0'; // Need this to prevent auto super bet
        }
        $scope.betSlip.counterOfferPossible = true;
        $scope.counterOffer.enabled = false;
        $scope.isBetAccepted = false;
        // switch to single if it available
        $scope.setBetSlipType(1, false);

        $scope.quickBet.enabled = false;

        Storage.remove('betslip');

        updateBetslipSubscription();
        broadcastBetslipState();

        clearFreeBet('freeBet');
        clearFreeBet('profitBoost');

        $scope.showRetainsButtons = false;

        if (cancelEditMode) {
            cancelEditBet();
        }
    };

    /**
     * @ngdoc method
     * @name addBet
     * @methodOf betting.controller:betSlipController
     * @param {Object} event event object
     * @param {Object} data bet data object
     * @description adds bet to betslip and stores betslip in local storage
     */
    function addBet(event, data) {
        if ($scope.disableAddBets && $scope.disableAddBets.addBet && !$rootScope.openSelectionsPart) return;

        if ($rootScope.editBet && $rootScope.editBet.edit && !$rootScope.editBet.openSelectionsPart) {
            $timeout.cancel($rootScope.editBet.unsubPromise); // Handling edge case, don't delete!
            $scope.disableAddBets.saveChanges = true;
        }

        if (!addBetInProgress && !$scope.shared.isBetsInProgress && $scope.quickBet.status !== 'processing' && ($filter('oddConvert')(data.event.price, 'decimal')) != 1 && !data.game.is_blocked && (Config.betting.enableHorseRacingBetSlip || (!Config.betting.enableHorseRacingBetSlip && data.event.price  !== undefined))) {//temporary reject add events without price into betslip

            $scope.isBetAccepted = false;
            $scope.isBetOnHold = false;

            if ($scope.quickBet.enabled) {
                $scope.placeQuickBet(data);
            } else {
                $scope.betSlip.generalBetResult = "";
                $scope.betSlip.bookingResultIds = [];

                if (!data.event || !data.game || !data.market || data.event.is_empty) {
                    console.warn('betslip got invalid data:', data);
                    return;
                }
                //check duplicate and delete it
                var isDuplicate = false;
                angular.forEach($scope.betSlip.bets, function (value) {

                    if (value.eventId === data.event.id) {
                        if (value.oddType === data.oddType) {
                            $scope.removeBet(value);
                        } else {
                            value.oddType = data.oddType;
                        }
                        isDuplicate = true;
                    } else {
                        //Check and replace the excluded event with a new one
                        if (value.gameId === data.game.id && value.expressId === data.market.express_id || value.gameId === data.game.exclude_ids || value.excludeIds === data.game.id) {
                            $scope.removeBet(value, true);
                            $scope.eventReplace.visibilityProcess = true;

                            TimeoutWrapper.cancel(eventReplaceMessageVisibilatyPromise); //TimeoutWrapper checks the existence of promise by itself

                            eventReplaceMessageVisibilatyPromise = TimeoutWrapper(function() {
                                $scope.eventReplace.visibilityProcess = false;
                            }, $scope.eventReplace.visibilityTime);
                        }
                    }
                });
                if (!isDuplicate) {

                    $scope.sysBetSelectedValue = 2;

                    if ($scope.betSlip.bets.length === 1 && $scope.betSlip.type.value === 1) {
                        $scope.betSlip.betterOddSelectionMode = false;

                        if (!$scope.counterOffer.enabled && !$scope.fullCoverBet.enabled) {
                            $scope.setBetSlipType(2, false);
                        }
                    }

                    if(Config.main.showPlayerRegion){
                        data.game.team1_name = data.game.team1_reg_name && data.game.team1_name.indexOf(data.game.team1_reg_name) === -1 ? data.game.team1_name + ' (' + data.game.team1_reg_name + ')' : data.game.team1_name;
                        data.game.team2_name = data.game.team2_reg_name && data.game.team2_name.indexOf(data.game.team2_reg_name) === -1 ? data.game.team2_name + ' (' + data.game.team2_reg_name + ')' : data.game.team2_name;
                    }
                    if (Config.main.limitForBetslipEvents && $scope.betSlip.bets.length >= Config.main.limitForBetslipEvents) {
                        $scope.moreThanEventsMaxNumber = false;
                        Utils.setJustForMoment($scope, 'moreThanEventsMaxNumber', true, 4000);
                        return;
                    }

                    var eventInfo = {
                        title: (data.game.displayTitle ?  data.game.displayTitle + " " : "") + getBetTitle(data.game),
                        pick: data.event.name,
                        price: data.event.price,
                        base: data.event.base !== undefined ? data.event.base : data.market.base,
                        baseInitial: data.event.base !== undefined ? data.event.base : data.market.base,
                        priceInitial: data.event.price,
                        betterPrice: calcBetterOdd (data.event.price),
                        marketName: $filter('improveName')(data.market.name, data.game),
                        marketType: data.market.type,
                        marketBase: data.market.base,
                        marketHomeScore: data.market.home_score,
                        marketAwayScore: data.market.away_score,
                        displayKey: data.market.display_key,
                        ewAllowed: !!data.event.ew_allowed,
                        exchangePrice: undefined,
                        eachWay: false,
                        ewCoeff: data.market.extra_info && data.market.extra_info.EachWayK,
                        spEnabled: data.event.sp_enabled,
                        oddType: data.oddType,
                        priceChange: null,
                        deleted: false,
                        processing: false,
                        blocked: (data.game.is_blocked || ($filter('oddConvert')(data.event.price, 'decimal')) == 1),
                        excludeIds: data.game.exclude_ids,
                        incInSysCalc: true,
                        banker: false,
                        expressId: data.market.express_id,
                        gameId: data.game.id,
                        eventId: data.event.id,
                        isLive: data.game.is_live !== undefined ? !!data.game.is_live : data.game.type === 1,
                        eventType: data.event.type,
                        eventType1: data.event.type_1,
                        team1Name: data.game.team1_name,
                        team2Name: data.game.team2_name,
                        expMinLen: data.game.express_min_len,
                        start_ts: data.game.start_ts,
                        singleStake: '',
                        singlePosWin: 0,
                        conflicts: getBetConflicts(data),
                        gamePointer: {
                            'game': data.game.id,
                            'sport': data.game.isVirtual ? -3 : data.game.sport.id,
                            'vsport':  data.game.isVirtual ? data.game.sport.id : undefined,
                            'competition': data.game.competition.id,
                            'type': (data.game.isVirtual || data.game.type === 2 ? 0 : data.game.type).toString(),
                            'region': data.game.region.id,
                            'alias': data.game.sport.alias,
                            'isLive': data.game.is_live
                        }
                    };
                    if ($location.path() === '/esports/') { eventInfo.gamePointer.path = '/esports'; } // Only used for navigation in eSports view for BBIN
                    if (data.game.sport.alias === 'HorseRacing' || data.game.sport.alias === 'SISGreyhound') {
                        eventInfo.start_ts = data.game.start_ts;
                    }

                    if (data.event.isSuggested) {
                        eventInfo.isSuggested = true;
                    } else if ($scope.betSlip.mode === 'suggested' || $scope.betSlip.mode === 'openBets') {
                        $scope.selectBetSlipMode('betting');
                    }

                    // checks if betSlip is in editMode , and new selections part is open => adds key in eventInfo to add it in new selections part
                    if ($rootScope.editBet && $rootScope.editBet.edit) {
                        if ($rootScope.editBet.originalEventIds.indexOf(eventInfo.eventId) > -1) {
                            eventInfo.originalEvent = true;
                        }
                        if ($rootScope.editBet.openSelectionsPart) {
                            eventInfo.showInSelections = $scope.showInSelections;
                            $scope.disableAddBets.newSelections = false;
                            $scope.emptyNewSelections = false;
                        }
                    }

                    $scope.betSlip.bets.push(eventInfo);

                    DomHelper.scrollBottom('betEventsContainer');
                    // corresponding input is waiting for this event to get focus.
                    // timeout is needed for input to become available for focusing
                    TimeoutWrapper(function () {
                        $scope.$broadcast('bet' + data.event.id);
                    }, 100);

                    updateBetslipSubscription();

                    if ($scope.lustMaxBetResult == $scope.betSlip.stake) {
                        $scope.betSlip.stake = undefined;
                    }
                    $scope.lustMaxBetResult = undefined;
                    checkFreeBet();
                    checkSuperBetAndCounterOffer();
                }

                Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
                broadcastBetslipState();
            }
        }
        addBetInProgress = false;
    }

    /**
     * @ngdoc method
     * @name getBetConflicts
     * @methodOf betting.controller:betslipCtrl
     * @description update bet conflicts
     */
    function getBetConflicts(data) {
        var conflicts = [];
        var pushValues = function pushValues (value) {
            conflicts.push({
                title: value.title,
                pick: value.pick,
                eventId: value.eventId
            });
            value.conflicts.push({
                title: data.game.team1_name + (data.game.team2_name ? ' - ' + data.game.team2_name : ''),
                pick: data.event.name,
                eventId: data.event.id
            });
        };

        angular.forEach($scope.betSlip.bets, function (value) {
            if (value.gameId === data.game.id && (data.market.express_id === undefined || value.expressId === undefined || value.expressId === data.market.express_id)) {
                pushValues(value);
            }

            if (value.gameId === data.game.exclude_ids || value.excludeIds === data.game.id) {
                pushValues(value);
            }
        });
        return conflicts;
    }

    /**
     * @ngdoc method
     * @name getBetSlipError
     * @methodOf betting.controller:betSlipController
     * @param {Object} result object
     * @returns {String}
     * @description return error messages. Used to remove multiple uses in this class
     */
    function getBetSlipError(result) {
        if (result === undefined) {
            return result;
        }

        if (result.result === '1510') {
            $scope.betSlip.lastErrorCode = result.result + '_sb';
        } else {
            $scope.betSlip.lastErrorCode = Math.abs(parseInt(result.code || result.result || result.status || 99, 10)).toString();
        }

        if (result.result_text && Translator.translationExists(result.result_text)) {
            return Translator.get(result.result_text);
        }

        if (result.details && result.details.api_code) {
            return Translator.get('api_' + result.details.api_code, undefined, 'eng');
        }


        var code = 'message_' + $scope.betSlip.lastErrorCode;

        if (Translator.translationExists('custom_' + code)) {
            return Translator.get('custom_' + code, undefined, lang);
        }

        if (Translator.get(code) !== code) {
            return Translator.get(code);
        }

        return Translator.get("Sorry we can't accept your bets now, please try later") + ' (' + Translator.get(result.result_text || code) + ')';
    }

    /**
     * @ngdoc method
     * @name autoSuperBet
     * @methodOf betting.controller:betSlipController
     * @param {Number} stake amount
     * @returns {Boolean}
     * @description return true in case of stake amount > superbetLimit
     */

    function autoSuperBet(stake) {
        return $scope.env.authorized && !$scope.betSlip.hasLiveEvents && Config.betting.autoSuperBetLimit && $rootScope.currency && $rootScope.currency.name && Config.betting.autoSuperBetLimit[$rootScope.currency.name] && stake >= Config.betting.autoSuperBetLimit[$rootScope.currency.name];
    }

    /**
     * @ngdoc method
     * @name processBetEvents
     * @methodOf betting.controller:betSlipController
     * @description Process bet events and put error message in resuls field
     */
    function processBetEvents (result, bet) {
        angular.forEach(result.details, function (betResult) {
            if (bet.eventId != betResult.event_id) {
                return;
            }

            if (betResult.status === "OK") {
                if ($scope.betSlip.type.value !== 1) {
                    bet.result = getBetSlipError(betResult);
                } else {
                    bet.isAccepted = false;
                    bet.result = getBetSlipError(result);

                }
            } else {
                bet.isAccepted = false;
                bet.result = getBetSlipError(betResult);
            }

            bet.processing = false;
        });
    }

    /**
     * @ngdoc method
     * @name placeBookingBet
     * @methodOf betting.controller:betSlipController
     * @description Place booking bet.
     */
    $scope.placeBookingBet = function placeBookingBet() {
        if ($scope.shared.betInProgress) { return; }
        $scope.shared.betInProgress = true;
        $scope.betSlip.generalBetResult = "";
        var requests = [];
        var currentBets;
        var layout = Config.main.sportsLayout + ($scope.env.live ? '(LIVE)' : '(PM)');

        analytics.gaSend('send', 'event', 'betting', 'PlaceBookingBet ' + layout, {'page': $location.path(), 'eventLabel': ({1: 'single', 2: 'express', 3: 'system', 4: 'chain'}[$scope.betSlip.type.value])});

        switch ($scope.betSlip.type.value) {
            case 1:
                angular.forEach($scope.betSlip.bets, function (bet) {
                    requests.push({
                        'type': $scope.betSlip.type.value,
                        'source': Config.betting.bet_source,
                        'amount': parseFloat(bet.singleStake),
                        'bets': [{'event_id': bet.eventId}]
                    });
                });
                break;
            case 3:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId});
                });
                requests.push({
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'amount': parseFloat($scope.betSlip.stake),
                    'bets': currentBets,
                    'sys_bet': parseInt($scope.sysBetSelectedValue, 10)
                });
                break;
            case 4:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId});
                });
                requests.push({
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'amount': parseFloat($scope.betSlip.stake),
                    'bets': currentBets
                });
                break;
            default:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId});
                });
                requests.push({
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'amount': parseFloat($scope.betSlip.stake),
                    'bets': currentBets
                });
                break;
        }

        $q.all(requests.map(function createAllPromises(request) { return Zergling.get(request, 'book_bet'); }))
            .then(function processBookingResults(bookings) {
                $scope.betSlip.bookingResultIds = [];
                for (var i = 0, l = bookings.length; i < l; i++) {
                    if (bookings[i].result === 0) {
                        $scope.betSlip.bookingResultIds.push(bookings[i].details.number);
                    } else {
                        // If even one event has an error, we don't print anything
                        $scope.betSlip.generalBetResult = getBetSlipError(bookings[i]);
                        analytics.gaSend('send', 'event', 'betting', 'RejectedBookingBet ' + layout,  {'page': $location.path(), 'eventLabel': ('err(' + bookings[i].result + ') - ' + bookings[i].details)});
                        return;
                    }
                }
                analytics.gaSend('send', 'event', 'betting', 'AcceptedBookingBet ' + layout, {'page': $location.path(), 'eventLabel': ({1: 'single', 2: 'express', 3: 'system', 4: 'chain'}[$scope.betSlip.type.value])});
                $scope.bookIdPopup($scope.betSlip.bookingResultIds);
                if (Config.main.bookingBetPrint && Config.main.bookingBetPrint.automat) {
                    $scope.openBookingPrintPopup();
                }
            })
            .catch(function(error) {
                $scope.betSlip.generalBetResult = getBetSlipError(error);
                analytics.gaSend('send', 'event', 'betting', 'RejectedBookingBet ' + layout, {'page': $location.path(), 'eventLabel': ('err(' + error.code + ') - ' + error.msg)});
            })
            .finally(function() {
                Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
                $scope.shared.betInProgress = false;
            });
    };

    /**
     * @ngdoc method
     * @name thereIsPriceChange
     * @methodOf betting.controller:betSlipController
     * @description  Indicate if bet slip events price is changing
     */

    $scope.thereIsPriceChange = function thereIsPriceChange() {
        $scope.isTherePriceChange = false;
        var priceAcceptanceValue = parseInt($scope.shared.acceptPriceChanges, 10);
        angular.forEach($scope.betSlip.bets, function (b) {
            if (b.oddType !== 'sp' && ((b.price - b.priceInitial < 0 && priceAcceptanceValue !== 2) || (b.price - b.priceInitial !== 0 && priceAcceptanceValue === 0))) {
                $scope.isTherePriceChange = true;
            }
        });

    };

    /**
     * @ngdoc method
     * @name getPriceChangeSettingsMode
     * @param {String} stakeAmount the current bet's amount
     * @param {Boolean} isCounterOffer  the counter offer enabled/disabled indicator
     *
     * @description calculate and return mode for bet
     */
    function getPriceChangeSettingsMode(stakeAmount, isCounterOffer) {
        switch (true) {
            case autoSuperBet(parseFloat(stakeAmount)):
                return -1;
            case isCounterOffer:
                return 3;
            case Config.main.priceChangesSettingMode[Config.env.oddFormat] !== undefined:
                return Config.main.priceChangesSettingMode[Config.env.oddFormat];
        }

        return parseInt($scope.shared.acceptPriceChanges, 10);
    }

    /**
     * @ngdoc method
     * @name placeQuickBet
     * @methodOf betting.controller:betSlipController
     * @param {Object} data selected event
     * @description place Quick Bet
     */

    $scope.placeQuickBet = function placeQuickBet(data) {
        console.log('quick bet data', data);
        if ($scope.betSlip.totalStake > $scope.profile.calculatedBalance + $scope.profile.calculatedBonus && Config.main.sportsLayout === 'classic') {
            $scope.quickBet.status = 'error';
            $scope.quickBet.massage = Translator.get('Insufficient balance');
        } else if ($scope.quickBet.enabled && !$scope.betSlip.hasEmptyStakes && $scope.env.authorized && !$scope.shared.isBetsInProgress && $scope.betSlip.totalStake <= $scope.profile.calculatedBalance + ($scope.profile.calculatedBonus || 0)) {
            $scope.quickBet.status = 'idle';
            $scope.quickBet.massage = '';

            TimeoutWrapper.cancel(showQuickBetWatcherPromise); //TimeoutWrapper checks the existence of promise by itself

            var request = {
                'type': 1,
                'source': Config.betting.bet_source,
                'amount': parseFloat($scope.betSlip.stake),
                'mode':  getPriceChangeSettingsMode($scope.betSlip.stake, false),
                'bets': [
                    {'event_id': data.event.id, 'price': data.oddType === 'sp' ? -1 : data.event.price}
                ]
            };

            if (Config.betting.bonusBetCheckbox) {
                request.wallet_type = $scope.bonusBet.enabled ? 2 : 1;
            }
            request.odd_type = getMappedOddType({});

            var processQuickBetResults = function (result) {
                console.log("request =", request);
                $scope.shared.isBetsInProgress = false;
                if (result.result === 'OK') {

                    BetIntelligent.storeBetInfo(result.details);

                    $rootScope.$broadcast('refreshBalance');
                    if (Config.main.enableBetPrint) {
                        $scope.betPrint.id = result.details.bet_id;
                    }
                    $scope.quickBet.status = 'accepted';
                    $scope.massage = getBetSlipError(result);
                    if(!data.game.isVirtual){
                        addGameToFavorites(data.game);
                    }
                } else if (result.result === -1) {
                    console.log('Error:', result.details);
                    $scope.quickBet.status = 'error';
                } else {
                    $scope.quickBet.status = 'error';
                    $scope.quickBet.massage = getBetSlipError(result);
                }
            };

            $scope.quickBet.status = 'processing';
            $scope.shared.isBetsInProgress = true;
            analytics.gaSend('send', 'event', 'betting', 'placeQuickBet' + (Config.main.sportsLayout),  {'page': $location.path(), 'eventLabel': ($scope.env.live ? '(LIVE)' : '(PM)')});
            Zergling
                .get(request, 'do_bet')
                .then(processQuickBetResults)['catch'](
                function (reason) {
                    $scope.quickBet.status = 'error';
                    $scope.shared.isBetsInProgress = false;
                    console.log('Error:', reason);
                    $scope.quickBet.massage = getBetSlipError(reason);
                }
            );

            showQuickBetWatcherPromise = TimeoutWrapper(function () {
                if ($scope.quickBet.status === 'processing') {
                    $scope.shared.isBetsInProgress = false;
                }
                $scope.quickBet.status = 'idle';
            }, 15000);
        }
    };

    function disableFreeBet(target) {
        $scope[target].selected = undefined;
        $scope[target].enabled = false;
    }

    function clearFreeBet(target) {
        disableFreeBet(target);
        $scope[target].list = undefined;
    }

    function getFreeBetList() {
        var requests = prepareBetsData(false, true);
        if (requests.length > 0) {
            Zergling.get(requests[0], 'get_freebets_for_betslip').then(function (response) {
                $scope.freeBet.list = [];
                $scope.profitBoost.list = [];
                if (response && response.details) {
                    angular.forEach(response.details, function (details) {
                        if (details.amount) {
                            $scope.freeBet.list.push(details);
                        }
                        if (details.amount_percent) {
                            $scope.profitBoost.list.push(details);
                        }
                    });
                }
                if (!$scope.freeBet.list.length) {
                    clearFreeBet('freeBet');
                } else {
                    $scope.freeBetStateChanged();
                }

                if (!$scope.profitBoost.list.length) {
                    clearFreeBet('profitBoost');
                } else {
                    $scope.handleProfitBoostState(null);
                }
            });
        }
    }
    /**
     * @ngdoc method
     * @name checkFreeBet
     * @methodOf betting.controller:betSlipController
     * @description check if free bet is avaliable
     */
    function checkFreeBet() {
        TimeoutWrapper.cancel(freebetPromise);

        if ($rootScope.profile && $rootScope.profile.has_free_bets && $scope.betSlip.bets.length && ($scope.betSlip.bets.length === 1 || $scope.betSlip.type.value !== 1 ||  $scope.betConf.fullCoverBetTypes.enabled)) {
            freebetPromise = TimeoutWrapper(getFreeBetList, promiseTimer);
        } else {
            clearFreeBet('freeBet');
            clearFreeBet('profitBoost');
        }
    }


    function loginActions() {
        $scope.taxOnStake.enabled = $rootScope.profile.is_tax_applicable && $rootScope.partnerConfig && $rootScope.partnerConfig.tax_percent && $rootScope.partnerConfig.tax_type === 4;

        checkFreeBet();
        getFavoriteStakes();
        if (Config.main.enableBetBooking) {
            $scope.selectBetSlipMode('betting');
        }
    }

    function logoutActions() {
        $scope.clearBetslip();
        $scope.taxOnStake.enabled = false;

        clearFreeBet('freeBet');
        clearFreeBet('profitBoost');
        getFavoriteStakes();
        if (Config.main.enableBetBooking) {
            $scope.selectBetSlipMode('booking');
        }
    }

    $scope.$on('loggedIn', loginActions);
    $scope.$on('login.loggedOut', logoutActions);

    /**
     * @ngdoc method
     * @name checkSuperBetAndCounterOffer
     * @methodOf betting.controller:betSlipController
     * @description Checks is there are any virtual sport events in the bet slip and disables superbet and counter offer accordingly
     */
    function checkSuperBetAndCounterOffer() {
        var virtualSportsEvents = false;
        for (var i = 0, x = $scope.betSlip.bets.length; i < x; i++) {
            if ($scope.betSlip.bets[i].gamePointer.sport === -3) {
                virtualSportsEvents = true;
                break;
            }
        }
        if (virtualSportsEvents) {
            $scope.betSlip.superbet.possible = false;
            $scope.betSlip.superbet.selector = false;
            $scope.betSlip.counterOfferPossible = false;
            $scope.counterOffer.enabled = false;
            $scope.shared.acceptPriceChanges = '0'; // Need this to prevent auto super bet
        } else {
            $scope.betSlip.superbet.possible = true;
            $scope.betSlip.counterOfferPossible = true;
        }
    }

    if ($rootScope.profile) {
        TimeoutWrapper(function () {
            checkFreeBet();
        }, 3000);
    }

    /**
     * @ngdoc method
     * @name handleProfitBoostState
     * @methodOf betting.controller:betSlipController
     * @description Checks and select according profit boost
     * @param {Object} boost the profit boost
     */
    $scope.handleProfitBoostState = function handleProfitBoostState(boost) {
        if ($scope.profitBoost.enabled) {
            disableFreeBet('freeBet');
            $scope.betSlip.superbet.selector = false;
            $scope.betSlip.mode = 'betting'; // switching to the betting mot
            if (boost) {
                $scope.profitBoost.selected = boost;
            } else if ($scope.profitBoost.list.indexOf($scope.profitBoost.selected) === -1) {
                $scope.profitBoost.selected = $scope.profitBoost.list[0];
            }
        } else {
            $scope.profitBoost.selected = undefined;
        }
    };


    function freeBetSelected (target) {
        return $scope[target].selected && $scope[target].selected.id;
    }

    $scope.freeBetStateChanged = function freeBetStateChanged(value) {
        value = value || 0;
        if ($scope.freeBet.enabled) {
            disableFreeBet('profitBoost');
            $scope.betSlip.superbet.selector = false;
            $scope.betSlip.mode = 'betting'; // switching to the betting mot

            if ($scope.fullCoverBet.enabled && Object.keys($scope.fullCoverBet.types).length) {
                for (var type in $scope.fullCoverBet.types) {
                    $scope.fullCoverBet.types[type].amount = '';
                    if ($scope.fullCoverBet.types[type].totalCoef > 0) { // If a full cover type has totalCoef property it signals that it is the 'express' type;
                        $scope.fullCoverBet.types[type].amount = $scope.freeBet.list[value].amount;
                    }
                }
                // Clearing up all single stake amounts
                for (var i = 0, x = $scope.betSlip.bets.length; i < x; i++) {
                    $scope.betSlip.bets[i].singleStake = '';
                }
            } else {
                $scope.betSlip.stake = $scope.freeBet.list[value].amount;
            }
            $scope.freeBet.selected = $scope.freeBet.list[value];
        } else {
            $scope.freeBet.selected = undefined;
        }
    };

    function addFullCoverBetRequests(requests, freeBet) {
        var expressBets = [], systemBets = [], request;
        var i, bet, length = $scope.betSlip.bets.length;

        if (freeBet) {
            request = {
                source: Config.betting.bet_source,
                mode: parseInt($scope.shared.acceptPriceChanges, 10),
                each_way: $scope.betSlip.eachWayMode,
                bets: requests.map(function(request) { return request.bets[0]; }),
                odd_type: getMappedOddType({}),
                type: 2
            };
            requests.unshift(request); // Unshifting the request because checkFreeBet() takes the first request in the array to check for free bets;
        } else {
            angular.forEach($scope.fullCoverBet.types, function (type, key) {

                if (key !== fullCoverTypesMap[1]) { // singles bet already added to the requests
                    if (!isNaN(type.amount) && parseFloat(type.amount) > 0) {

                        request = {
                            source: Config.betting.bet_source,
                            mode: parseInt($scope.shared.acceptPriceChanges, 10),
                            each_way: type.ewMode,
                            type: type.type,
                            odd_type: getMappedOddType({}),
                            amount: parseFloat(type.amount) * type.count * (type.ewMode ? 2 : 1) // If each way mode is on the stake is doubled
                        };

                        if (type.type === 3) { // calculates as systembet
                            if (!systemBets.length) {
                                for (i = 0; i < length; ++i) {
                                    bet = $scope.betSlip.bets[i];
                                    systemBets.push({'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : bet.price, 'banker': bet.banker ? 1 : 0});
                                    bet.processing = true;
                                }
                            }
                            request.bets = systemBets;
                            request.sys_bet = type.sysCount + ($scope.betSlip.bankerBetsCount ? $scope.betSlip.bankerBetsCount : 0)
                        } else {
                            if (!expressBets.length) {
                                for (i = 0; i < length; ++i) {
                                    bet = $scope.betSlip.bets[i];
                                    expressBets.push({'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : bet.price});
                                    bet.processing = true;
                                }
                            }
                            request.bets = expressBets;
                        }

                        requests.push(request);
                    }
                }
            });
        }
    }

    function getMappedOddType(bet) {
        // if (Config.main.oddTypeMapInPlacingBet && Config.main.oddTypeMapInPlacingBet[$rootScope.env.oddFormat]) {
        //     return ODD_TYPE_MAP[Config.main.oddTypeMapInPlacingBet[$rootScope.env.oddFormat]];
        // }

        if ($scope.betSlip.type.value !== 1 || !Config.main.specialOddFormat || !Config.main.specialOddFormat[$rootScope.env.oddFormat] || Config.main.specialOddFormat[$rootScope.env.oddFormat].displayKey[bet.displayKey]) {
            return ODD_TYPE_MAP[Config.env.oddFormat];
        }

        return ODD_TYPE_MAP[Config.main.specialOddFormat[$rootScope.env.oddFormat].default];
    }
    /**
     * @ngdoc method
     * @name placeBet
     * @methodOf betting.controller:betSlipController
     * @description Prepares bet data, for booking and betting free bet and single bet events
     * @param {Boolean} singleBetEvent True if its a single bet;
     * @param {Boolean} forFreeBet True if calculation must be done for free bet;
     */
    function prepareBetsData (singleBetEvent, forFreeBet) {
        var requests = [], data;
        var currentBets, anySuggestedEvents;
        switch ($scope.betSlip.type.value) {
            case 1:
                var bets = singleBetEvent ? [singleBetEvent] : $scope.betSlip.bets;
                angular.forEach(bets, function (bet) {
                    if ((!$scope.betSlip.thereAreDeletedEvents && !$scope.isTherePriceChange && !isNaN(parseFloat(bet.singleStake))) || forFreeBet) {
                        var isCounterOffer = $scope.counterOffer.enabled && bet.counterOffer > bet.price;
                        data = {
                            'type': $scope.betSlip.type.value,
                            'source': Config.betting.bet_source,
                            'is_offer': $scope.betSlip.betterOddSelectionMode ? 1 : 0,
                            'mode': getPriceChangeSettingsMode(bet.singleStake, isCounterOffer),
                            'each_way': bet.eachWay,
                            'bets': [
                                {'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : $scope.betSlip.betterOddSelectionMode ? bet.betterPrice : (isCounterOffer ? parseFloat(bet.counterOffer) : bet.price)}
                            ]
                        };
                        if (bet.isSuggested && $rootScope.suggestedBets && $rootScope.suggestedBets.tags) {
                            data.tags = $rootScope.suggestedBets.tags;
                        }
                        if (!forFreeBet) {
                            data.amount = parseFloat(bet.customSingleStake || bet.singleStake) * (bet.eachWay ? 2 : 1); // If each way mode is on the stake is doubled
                        } else {
                            data.is_live = bet.isLive;
                        }
                        if($rootScope.editBet && $rootScope.editBet.edit) {
                            data.amount  = $rootScope.editBet.stakeAmount;
                            data.additional_amount = parseFloat($rootScope.editBet.increaseStake.savedAmount) || 0;
                            data.old_bet_id = $rootScope.editBet.oldBetId;
                        }
                        data.odd_type = getMappedOddType(bet);
                        requests.push(data);
                        bet.processing = !forFreeBet;
                    }
                });

                if ($scope.betConf.fullCoverBetTypes.enabled && $scope.betSlip.bets.length > 1) {
                    addFullCoverBetRequests(requests, forFreeBet);
                }
                break;
            case 2:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : bet.price});
                    bet.processing = !forFreeBet;
                    anySuggestedEvents = anySuggestedEvents || bet.isSuggested;
                });
                data = {
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'mode': getPriceChangeSettingsMode($scope.betSlip.stake, false),
                    'each_way': $scope.betSlip.eachWayMode,
                    'bets': currentBets
                };
                if (anySuggestedEvents) {
                    data.tags = $rootScope.suggestedBets.tags;
                }
                if (!forFreeBet) {
                    data.amount = $scope.betSlip.stake * ($scope.betSlip.eachWayMode ? 2 : 1);
                } else {
                    data.is_live = $scope.betSlip.hasLiveEvents;
                }
                if($rootScope.editBet && $rootScope.editBet.edit) {
                    data.amount  = $rootScope.editBet.stakeAmount;
                    data.additional_amount = parseFloat($rootScope.editBet.increaseStake.savedAmount) || 0;
                    data.old_bet_id = $rootScope.editBet.oldBetId;
                }
                data.odd_type = getMappedOddType({});
                requests.push(data);
                break;
            case 3:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : bet.price, 'banker': bet.banker ? 1 : 0});
                    bet.processing = !forFreeBet;
                    anySuggestedEvents = anySuggestedEvents || bet.isSuggested;
                });
                data = {
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'mode': getPriceChangeSettingsMode($scope.betSlip.stake, false),
                    'each_way': $scope.betSlip.eachWayMode,
                    'bets': currentBets,
                    'sys_bet': parseInt($scope.sysBetSelectedValue, 10) + ($scope.betSlip.bankerBetsCount ? $scope.betSlip.bankerBetsCount : 0)
                };
                if (anySuggestedEvents) {
                    data.tags = $rootScope.suggestedBets.tags;
                }
                if (!forFreeBet) {
                    data.amount = $scope.betSlip.stake * ($scope.betSlip.eachWayMode ? 2 : 1);
                } else {
                    data.is_live = $scope.betSlip.hasLiveEvents;
                }
                data.odd_type = getMappedOddType({});
                requests.push(data);
                break;
            case 4:
                currentBets = [];
                angular.forEach($scope.betSlip.bets, function (bet) {
                    currentBets.push({'event_id': bet.eventId, 'price': bet.oddType === 'sp' ? -1 : bet.price});
                    bet.processing = !forFreeBet;
                    anySuggestedEvents = anySuggestedEvents || bet.isSuggested;
                });
                data = {
                    'type': $scope.betSlip.type.value,
                    'source': Config.betting.bet_source,
                    'mode': getPriceChangeSettingsMode($scope.betSlip.stake, false),
                    'each_way': $scope.betSlip.eachWayMode,
                    'bets': currentBets
                };
                if (anySuggestedEvents) {
                    data.tags = $rootScope.suggestedBets.tags;
                }
                if (!forFreeBet) {
                    data.amount = parseFloat($scope.betSlip.stake);
                } else {
                    data.is_live = $scope.betSlip.hasLiveEvents;
                }
                data.odd_type = getMappedOddType({});
                requests.push(data);
                break;
            default:
                break;
        }
        return requests;
    }

    /**
     * @ngdoc method
     * @name placeBet
     * @methodOf betting.controller:betSlipController
     * @description place current bets
     * @param {Number} singleBetEvent Event Optional;
     */
    function placeBet(singleBetEvent) {
        console.log('placeBet');

        if ($scope.shared.betInProgress && $rootScope.editBet && !$rootScope.editBet.edit) {
            return;
        }
        $scope.shared.betInProgress = true;
        $scope.isAcceptAndPlaceBetStarted = false;
        $scope.betSlip.generalBetResult = "";
        $scope.betSlip.bookingResultIds = [];

        analytics.gaSend('send', 'event', 'betting', 'PlaceBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'), {'page': $location.path(), 'eventLabel': ({1: 'single', 2: 'express', 3: 'system', 4: 'chain'}[$scope.betSlip.type.value])});
        var requests = prepareBetsData(singleBetEvent);

        var betCounter = 0, haveAcceptedEvent = false, enablePopupAfterBet = false;
        if (requests.length) {
            angular.forEach(requests, function (request) {
                var processBetResults = function (result) {
                    if (result.result === 'OK') {

                        BetIntelligent.storeBetInfo(result.details);

                        if (Config.main.enableBetPrint) {
                            $scope.betPrint.id  = result.details.bet_id;
                        }

                        if (request.mode == 3) {
                            $rootScope.superbetIds.counterOffers.push(result.details.bet_id);
                        }



                        if($rootScope.editBet) {
                            cancelEditBet();
                        }

                        if(Config.betting.enableRetainSelectionAfterPlacment){
                            $scope.showRetainsButtons = true;
                            if ($scope.betSlip.superbet.selector) {
                                $scope.togglesSuperbetSelector();
                            }
                        }
                        haveAcceptedEvent = true;
                        if ($scope.betConf.popupMessageAfterBet && $scope.betConf.popupMessageAfterBet[$rootScope.currency.name] && result.details.amount >= $scope.betConf.popupMessageAfterBet[$rootScope.currency.name]) {
                            enablePopupAfterBet = true;
                        }
                        if (Config.main.enableSuggestedBets) {
                            $rootScope.$broadcast('suggestedBets.get', {type: 'preMatch'});
                        }
                        if (result.details && result.details.FreeBetAmount) {
                            checkFreeBet();
                        }
                        analytics.gaSend('send', 'event', 'betting', 'AcceptedBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'), {'page': $location.path(), 'eventLabel': ({1: 'single', 2: 'express', 3: 'system', 4: 'chain'}[$scope.betSlip.type.value])});
                        $rootScope.$emit('trackingEvent', { category: 'AcceptedBet',label: ({1: 'single', 2: 'express', 3: 'system', 4: 'chain'}[$scope.betSlip.type.value])}); // SDC-39274

                        TimeoutWrapper.cancel(betAcceptedWatcherPromise); // TimeoutWrapper checks the existence of promise by itself

                        $scope.isBetAccepted = true;
                        $scope.isSuperbet = result.details.is_superbet;

                        if (request.mode == -1 && $scope.isSuperbet) {
                            $rootScope.superbetIds.superBets.push(result.details.bet_id);
                        }

                        var hasCounterOffer = false;
                        betAcceptedWatcherPromise = TimeoutWrapper(function () { $scope.isBetAccepted = false; }, Config.betting.betAcceptedMessageTime);
                        angular.forEach($scope.betSlip.bets, function (value) {
                            if (!value.gamePointer.vsport) {
                                addGameToFavorites({id: value.gameId});
                            }

                            if (value.counterOffer && parseFloat(value.counterOffer) > value.price) {
                                hasCounterOffer = true;
                            }
                            if (request.type !== 1 || request.bets[0].event_id == value.eventId) {
                                $scope.betslipRemoveBetsProcess = true; // bad solution for disable place bet button until removing betslip
                                value.isAccepted = true;
                                value.result = getBetSlipError(result);
                                if (Config.betting.alternativeBetSlip) {
                                    $rootScope.notificationPopup = {title: Translator.get('Your bet is accepted.')};
                                }
                                TimeoutWrapper(function () {
                                    if(!Config.betting.enableRetainSelectionAfterPlacment) {
                                        $scope.removeBet(value);
                                        if (Config.betting.resetAmountAfterBet) {
                                            $scope.betSlip.stake = undefined;
                                        }
                                    }
                                    $scope.betslipRemoveBetsProcess = false;
                                    value.processing = false;

                                }, 1000);
                            }
                        });
                        //superbet for spring================================= // also for counter offer
                        if (parseInt($scope.shared.acceptPriceChanges, 10) === -1 && !$scope.counterOffer.enabled) {
                            $scope.isBetOnHold = true;
                            $scope.shared.acceptPriceChanges = '0';
                        }
                        //superbet for spring end==============================
                    } else if (result.result === -1) {
                        // if($rootScope.editBet) {
                        //     $rootScope.editBet.edit = true;
                        // }
                        console.log('Error:', result.details);
                        $scope.betSlip.generalBetResult = getBetSlipError(result);
                        analytics.gaSend('send', 'event', 'betting', 'RejectedBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'),  {'page': $location.path(), 'eventLabel': ('err(' + result.result + ') - ' + result.details)});
                        if (Config.betting.alternativeBetSlip) {
                            $rootScope.notificationPopup = {title: Translator.get('Your bet is not accepted'), message: $scope.betSlip.generalBetResult};
                        }
                        angular.forEach($scope.betSlip.bets, function (value) {
                            value.processing = false;
                        });
                    } else if (result.result === 3019) {
                        // if($rootScope.editBet) {
                        //     $rootScope.editBet.edit = true;
                        // }
                        console.log('Error:', result.details);
                        $scope.betSlip.generalBetResult = Translator.get("Incompatible bet") + ' (' + result.result + ')';
                        analytics.gaSend('send', 'event', 'betting', 'RejectedBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'),  {'page': $location.path(), 'eventLabel': ('err(' + result.result + ') - ' + result.details)});
                        if (Config.betting.alternativeBetSlip) {
                            $rootScope.notificationPopup = {title: Translator.get('Incompatible bet'), message: $scope.betSlip.generalBetResult};
                        }
                        angular.forEach($scope.betSlip.bets, function (value) {
                            value.processing = false;
                        });
                    } else {
                        // if($rootScope.editBet) {
                        //     $rootScope.editBet.edit = true;
                        // }
                        $scope.betSlip.generalBetResult = getBetSlipError(result);

                        if (Config.betting.alternativeBetSlip) {
                            $rootScope.notificationPopup = {title: Translator.get('Your bet is not accepted'), message: $scope.betSlip.generalBetResult};
                        }

                        analytics.gaSend('send', 'event', 'betting', 'RejectedBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'),  {'page': $location.path(), 'eventLabel': ('err(' + result.result + ') - ' + result.details)});
                        if (result.result == '1800' && !Storage.get('settingAutoShowOneDayDelay')) {
                            Storage.set('settingAutoShowOneDayDelay', true, 86400000);
                            $scope.shared.showBetSettings = true;
                        }
                        angular.forEach($scope.betSlip.bets, function (bet) {
                            if (result.details && result.details !== null) {
                                processBetEvents(result, bet);
                            } else {
                                bet.processing = false;
                            }
                        });
                    }
                    //$scope.shared.betInProgress = false;
                    hideBetProcessLoaders();
                };

                if (Config.betting.bonusBetCheckbox) {
                    request.wallet_type = $scope.bonusBet.enabled ? 2 : 1;
                }

                if (freeBetSelected('freeBet')) {
                    request.bonus_id = $scope.freeBet.selected.id;
                } else if (freeBetSelected('profitBoost')) {
                    request.bonus_id = $scope.profitBoost.selected.id;
                }

                if ($scope.bonusBet.enabled) {
                    request.is_bonus_money = true;
                }

                if (Config.main.enableSuggestedBets && !request.tags) {
                    request.tags = 0;

                    if ($rootScope.suggestedBets && $rootScope.suggestedBets.eventIds.length) {
                        var suggestedBetsIds = $rootScope.suggestedBets.eventIds;

                        if (request.type === 2 /* express */ && suggestedBetsIds.length === request.bets.length) {
                            request.tags = $rootScope.suggestedBets.tags;
                            for (var i = 0; i < request.bets.length; i++) {
                                if (suggestedBetsIds.indexOf(request.bets[i].event_id) === -1) {
                                    request.tags = 0;
                                    break;
                                }
                            }
                        }
                    }
                }

                Zergling
                    .get(request, 'do_bet').then(processBetResults)['catch'](function (reason) {
                    console.log('Error:', reason);
                    $scope.shared.betInProgress = false;
                    $scope.betSlip.generalBetResult = getBetSlipError(reason);
                    if (Config.betting.alternativeBetSlip) {
                        $rootScope.notificationPopup = {title: Translator.get('Your bet is not accepted'), message: $scope.betSlip.generalBetResult};
                    }
                    analytics.gaSend('send', 'event', 'betting', 'RejectedBet ' + (Config.main.sportsLayout) + ($scope.env.live ? '(LIVE)' : '(PM)'), {'page': $location.path(), 'eventLabel': ('err(' + reason.code + ') - ' + reason.msg)});
                    angular.forEach($scope.betSlip.bets, function (value) {
                        value.processing = false;
                    });
                })['finally'](function () {
                    betCounter++;
                    if (haveAcceptedEvent && requests.length === betCounter) {
                        if (Config.partner.balanceRefreshPeriod || Config.main.rfid.balanceRefreshPeriod) { // refresh balance right after doing bet in integration skin
                            $rootScope.$broadcast('refreshBalance');
                        }
                        enablePopupAfterBet && $rootScope.$broadcast('showPopupBySlug', 'after_bet');
                    }
                    $scope.shared.betInProgress = false;
                });
            });
        } else {
            $scope.shared.betInProgress = false;
        }
    }

    /**
     * @ngdoc method
     * @name factorial
     * @methodOf betting.controller:betSlipController
     * @param {Number} x x
     * @returns {Number} factorial
     * @description calculate factorial
     */
    function factorial(x) {
        if (x !== undefined && !isNaN(x) && x >= 0) {
            return x === 0 ? 1 : (x * factorial(x - 1));
        }
    }

    /**
     * @ngdoc method
     * @name calculateSystemPossibleWin
     * @methodOf betting.controller:betSlipController
     * @returns {Object} possible win and options count
     * @description calculate system possible winning sets system selected value
     */
    function calculateSystemPossibleWin(k, stake) {
        var tempPosWin = 0;
        var tempPosEwWin = 0;
        var indexArray = [];
        var indexMaxArray = [];
        var tempOdd;
        var tempEwOdd;
        var tempIterator;
        var numOfSysOptions;
        var sysPerBetStake;
        var i;
        k = k || $scope.sysBetSelectedValue;
        if ($rootScope.editBet && $rootScope.editBet.edit && $rootScope.editBet.stakeAmount) {
            // We use increaseStake.amount instead of .savedAmount, so we calculate possible win before user saves changes
            stake = $rootScope.editBet.stakeAmount + parseFloat($rootScope.editBet.increaseStake.amount || 0);
        } else {
            stake = stake || $scope.betSlip.stake;
        }
        for (i = 0; i < k; i++) {
            indexArray[i] = i;
            indexMaxArray[i] = $scope.betSlip.bets.length - i;
        }

        indexMaxArray = indexMaxArray.reverse();
        tempIterator = k - 1;
        var m, j;
        while (indexArray[0] <= indexMaxArray[0]) {
            if (indexArray[tempIterator] < indexMaxArray[tempIterator]) {
                if (tempIterator !== k - 1) {
                    tempIterator = k - 1;
                    continue;
                }
                tempOdd = 1;
                tempEwOdd = 1;
                for (m = 0; m < k; m++) {
                    if ($scope.betSlip.bets[indexArray[m]].incInSysCalc && !$scope.betSlip.bets[indexArray[m]].banker) {
                        tempOdd *= convertFractionalPrice($scope.betSlip.bets[indexArray[m]].price);
                        tempEwOdd *= $scope.betSlip.bets[indexArray[m]].ewAllowed && $scope.betSlip.bets[indexArray[m]].ewCoeff ? Math.round(((convertFractionalPrice($scope.betSlip.bets[indexArray[m]].price) - 1) / $scope.betSlip.bets[indexArray[m]].ewCoeff + 1) * 100) / 100 : convertFractionalPrice($scope.betSlip.bets[indexArray[m]].price);
                    } else {
                        tempOdd = 0;
                        tempEwOdd = 0;
                    }
                }
                tempPosWin = (tempPosWin * 10 * 10 + mathCuttingFunction(tempOdd * 10 * 10)) / 100;
                tempPosEwWin = tempPosEwWin + tempEwOdd;

                indexArray[tempIterator]++;
            } else {
                tempIterator--;

                indexArray[tempIterator]++;

                for (j = tempIterator; j < k - 1; j++) {
                    indexArray[j + 1] = indexArray[j] + 1;
                }
            }
        }

        numOfSysOptions = Math.round(factorial($scope.betSlip.bets.length - $scope.betSlip.bankerBetsCount) / (factorial(k) * factorial($scope.betSlip.bets.length - k - $scope.betSlip.bankerBetsCount)));

        sysPerBetStake = stake / numOfSysOptions;

        return {win: mathCuttingFunction(tempPosWin * sysPerBetStake*100)/100, ewWin: mathCuttingFunction(tempPosEwWin * sysPerBetStake*100)/100, options: numOfSysOptions};
    }

    /**
     * @ngdoc method
     * @name calcSystemOptionsCount
     * @methodOf betting.controller:betSlipController
     * @param {Number} k number of selected events
     * @description calculate system options count
     */
    $scope.calcSystemOptionsCount = function calcSystemOptionsCount(k) {
        return Math.round(factorial($scope.betSlip.bets.length - $scope.betSlip.bankerBetsCount) / (factorial(k) * factorial($scope.betSlip.bets.length - k - $scope.betSlip.bankerBetsCount)));
    };

    /**
     * @ngdoc method
     * @name expressBonusCalculator
     * @methodOf betting.controller:betSlipController
     * @param {Number} n number of events,
     * @param {Number} k odd,
     * @param {Number} s stake,
     * @description calculate express bonus
     */
    function expressBonusCalculator(n, k, s) {
        if (!$scope.expressBonus.map) { return 0; }

        var calc = $scope.expressBonus.map;
        if (calc !== undefined && (calc.min === undefined || n >= calc.min)) {
            if (calc.minTotalCoefficient !== undefined && k < calc.minTotalCoefficient) {
                return 0;
            } else if (calc[n] === 0) {
                return 0;
            } else if (calc[n]) {
                // Bonus percent of -1 signifies that the percent should be proportionate to the number of events in bet slip
                return (k * s - s) * ( (calc[n] === -1 ? n : calc[n]) * 0.01);
            } else if (calc.default) {
                return (k * s - s) * ( (calc.default === -1 ? n : calc.default) * 0.01);
            }
        }
    }

    var calculateExpressBonus;
    if ($injector.has('ExpressBonusCalculator')) {
        calculateExpressBonus = $injector.get('ExpressBonusCalculator').calculate;
    } else {
        calculateExpressBonus = function (betSlip) {
            if (!$scope.expressBonus || !$scope.expressBonus.enabled) { return; }
            var expressBonusMap = $scope.expressBonus.map;
            var minOdd = $scope.expressBonus.minOdds, length = betSlip.bets.length;
            if ($scope.expressBonus.ignoreLowOdds && length > $scope.expressBonus.visibilityQty) {
                /* e.g.
                    $scope.expressBonus.visibilityQty: n,
                    $scope.expressBonus.minOdds: m,

                   if there are at least n+1 events in betSlip, and bet.price >= m for at least n+1 events, then newExpressBonus would continue to calculate the express bonus
                 */
                var oddForNewExpressBonus = 1;
                var n = 0;
                angular.forEach(betSlip.bets, function (bet) {
                    if (bet.price && bet.price >= minOdd) {
                        if(oddForNewExpressBonus * bet.price >= betSlip.expOdds) {
                            oddForNewExpressBonus = betSlip.expOdds;
                        } else {
                            oddForNewExpressBonus *= bet.price;
                        }
                        n++;
                    }
                });

                $scope.betSlip.expBonusPercentage = expressBonusMap[n] !== undefined ? expressBonusMap[n] : expressBonusMap.default;
                $scope.betSlip.expBonusPercentage = $scope.betSlip.expBonusPercentage === -1 ? n : $scope.betSlip.expBonusPercentage;

                if (expressBonusMap.minTotalCoefficient !== undefined && oddForNewExpressBonus < expressBonusMap.minTotalCoefficient) {
                    return;
                } else if (expressBonusMap[n] === 0) {
                    return;
                } else if (expressBonusMap[n]) {
                    return (finalWinValue - betSlip.stake) * ( (expressBonusMap[n] === -1 ? n : expressBonusMap[n]) * 0.01);
                } else if (expressBonusMap.default) {
                    return (finalWinValue - betSlip.stake) * ( (expressBonusMap.default === -1 ? n : expressBonusMap.default)  * 0.01);
                }
            } else {
                for (var i = 0; i < length; i++) {
                    if(betSlip.bets[i].price < minOdd) {
                        $scope.totalPossibleWin = undefined;
                        return 0;
                    }
                }
            }

            if($scope.taxOnStake.enabled) {
                return Math.round(expressBonusCalculator(betSlip.bets.length, betSlip.expOdds, $scope.taxOnStake.total) * 100 || 0) / 100;
            } else {
                return Math.round(expressBonusCalculator(betSlip.bets.length, betSlip.expOdds, betSlip.stake) * 100 || 0) / 100;
            }
        };
    }
    calculateExpressBonus = Utils.memoize(calculateExpressBonus);

    function setMaxWinLimit(value) {
        if ($scope.env.authorized && $rootScope.currency && $rootScope.currency.rounding !== undefined && !isNaN($rootScope.currency.rounding)) {
            if (Config.betting.maxWinLimit && $rootScope.currency.amd_rate && value * $rootScope.currency.amd_rate > Config.betting.maxWinLimit) {
                return parseFloat((Config.betting.maxWinLimit / $rootScope.currency.amd_rate).toFixed(Math.abs($rootScope.currency.rounding)));
            }
            return parseFloat(value.toFixed(Math.abs($rootScope.currency.rounding)));
        }
        return parseFloat(value);
    }

    function calcSinglePosWinAndTotalStake(bet, price) {
        price = convertFractionalPrice(price);
        $scope.betSlip.totalStake += bet.singleStake * 1;
        bet.customSingleStake && (delete bet.customSingleStake);
        if (bet.eachWay && bet.ewAllowed && bet.ewCoeff) {
            $scope.betSlip.totalStake += +bet.singleStake; // We double the stake because of each way
            bet.singlePosWin = setMaxWinLimit(mathCuttingFunction((((price - 1) / bet.ewCoeff + 1) + price) * bet.singleStake * 100)/ 100);
        } else {
            bet.singlePosWin = setMaxWinLimit(mathCuttingFunction((price * bet.singleStake) * 10 * 10 || 0) / 100);
        }
    }

    function calcCustomAmountAndTotalStake(bet, price) {
        var singleStake = parseFloat(bet.singleStake);

        if ($rootScope.currency.rounding === 0) {
            bet.customSingleStake = +((singleStake / (price - 1) * 10 * 10) / 100).toFixed(0);
        } else {
            bet.customSingleStake = mathCuttingFunction(singleStake / (price - 1) * 10 * 10) / 100;
        }

        bet.singlePosWin = bet.customSingleStake + singleStake;
        $scope.betSlip.totalStake += bet.customSingleStake * 1;
    }

    /**
     * @ngdoc method
     * @name convertFractionalPrice
     * @methodOf betting.controller:betSlipController
     * @description Calculate fractional price using filter
     */
    function convertFractionalPrice (price) {
        if (price && Config.env.oddFormat === 'fractional' && Config.betting.possibleWinFractionalCalculation) {
            var priceFractional = $filter('oddConvert')(price, 'fractional', undefined, undefined, Config.main.showCustomNameForFractionalFormat).split('/');
            price = priceFractional[0] / priceFractional[1] + 1;
        }
        return price;
    }

    /**
     * @ngdoc method
     * @name calculateTax
     * @methodOf betting.controller:betSlipController
     * @description Calculate tax for given possible win and stake
     * @param {Number} possibleWin
     * @param {Number} stake
     */
    var calculateTax =  Utils.memoize(function calculateTax(possibleWin, stake) {
        var tax = 0;
        var taxPercent = $rootScope.partnerConfig.tax_percent;
        if ($rootScope.partnerConfig.tax_type === 20 && taxPercent) {
            tax =  possibleWin  * (taxPercent / 100);
        } else if ({1: 1, 2:1}[$rootScope.partnerConfig.tax_type]) {
            var ranges = $rootScope.partnerConfig.tax_amount_ranges;
            var netWin = possibleWin - ($rootScope.partnerConfig.tax_type === 1? stake : 0);
            var isContains = false;
            if (ranges && ranges.length) {
                for (var i = ranges.length; i--;) {
                    var range = ranges[i];
                    if (netWin > range.from && netWin <= range.to) {
                        isContains = true;
                        break;
                    }
                }
            }
            if (!isContains) {
                tax =  netWin * (taxPercent / 100);
            } else {
                var length = ranges.length;
                var remain = netWin;
                for (var i = 0; i < length; ++i) {
                    var range = ranges[i];
                    if (remain > range.to) {
                        tax += range.to * (range.percent / 100);
                        remain -= range.to;
                    } else {
                        tax += remain * (range.percent / 100);
                        break;
                    }

                }
            }
        }
        return tax;
    });

    function calcBetPrice(price) {
        price = convertFractionalPrice(price);
        return  Config.main.decimalFormatRemove3Digit ? (mathCuttingFunction(price * 10 * 10) / 100) : price;
    }

    /**
     * @ngdoc method
     * @name posWin
     * @methodOf betting.controller:betSlipController
     * @description calculate possible Win for current bets
     */
    $scope.posWin = function posWin() {
        var totalOdd = 1;
        var ewOdd = 1;
        var possibleWin = 0;
        var chainTotalPrice = 0;
        var bankerTotalPrice = 1;
        var tmpBankerBetsCount = 0;
        var sameGameIds = {};
        var isCalculateTax = $rootScope.partnerConfig && ($rootScope.partnerConfig.tax_percent || ($rootScope.partnerConfig.tax_amount_ranges && $rootScope.partnerConfig.tax_amount_ranges.length)) && {1:1, 2:1, 20:1}[$rootScope.partnerConfig.tax_type];
        $scope.betSlip.maxOddsWarningAmount = false;
        $scope.betSlip.hasConflicts = false;
        $scope.betSlip.eachWayPossible = true;
        $scope.betSlip.hasSingleOnlyEvents = false;
        $scope.betSlip.hasEmptyStakes = false;
        $scope.betSlip.hasFilledStake = false;
        $scope.betSlip.hasLockedEvents = false;
        $scope.betSlip.thereAreDeletedEvents = false;
        $scope.betSlip.hasSpOddTypes = false;
        $scope.betSlip.hasLiveEvents = false;
        $scope.betSlip.hasEventsFromSameGame = false;
        $scope.betSlip.sysValArray = [];
        $scope.betSlip.hasCounterOfferError = false;

        if (!$scope.quickBet.enabled) {
            $scope.shared.isBetsInProgress = false;
            $scope.quickBet.status = 'idle';
        } else {
            $scope.quickBetStakeCoeff = Config.betting.quickBet.quickBetStakeCoeffs[$rootScope.currency.name];
            $scope.quickBetStakeSelector = $scope.quickBetStakeSelector || Config.betting.quickBet.quickBetStakeCoeffs[$rootScope.currency.name];
        }

        if ($scope.betSlip.type.value === 1 && !$scope.quickBet.enabled) {
            $scope.betSlip.totalStake = 0;
        } else if ($rootScope.editBet && $rootScope.editBet.edit) {
            // We use increaseStake.amount instead of .savedAmount, so we calculate possible win before user saves changes
            $scope.betSlip.totalStake =  $rootScope.editBet.stakeAmount + parseFloat($rootScope.editBet.increaseStake.amount || 0);
            $scope.betSlip.eachWayMode = false;
            $scope.betSlip.eachWayPossible = false;
        } else {
            $scope.betSlip.totalStake = parseFloat($scope.betSlip.stake) || 0;
        }

        angular.forEach($scope.betSlip.bets, function (bet, i) {
            switch ($scope.betSlip.type.value) {
                case 1://single
                    if ($scope.betSlip.bets.length === 1 && !Config.betting.alternativeBetSlip) {
                        bet.singleStake = $scope.betSlip.stake;
                        bet.eachWay = $scope.betSlip.eachWayMode;
                    }
                    if($rootScope.editBet && $rootScope.editBet.edit) {
                        // We use increaseStake.amount instead of .savedAmount, so we calculate possible win before user saves changes
                        bet.singleStake = $rootScope.editBet.stakeAmount + parseFloat($rootScope.editBet.increaseStake.amount || 0);
                    }
                    $scope.betSlip.hasEmptyStakes = $scope.betSlip.hasEmptyStakes || bet.singleStake === undefined || bet.singleStake == "" || parseFloat(bet.singleStake) === 0;
                    if (!isNaN(parseFloat(bet.singleStake)) && parseFloat(bet.singleStake) > 0 && !bet.deleted && bet.oddType !== 'sp' && !bet.blocked) {
                        var realPrice = $scope.betSlip.betterOddSelectionMode ? bet.betterPrice : ($scope.counterOffer.enabled && bet.counterOffer > bet.price ? bet.counterOffer : (Config.main.decimalFormatRemove3Digit ? parseFloat($filter('oddConvert')(bet.price, 'decimal')): bet.price));

                        if ($scope.betSlip.type.value === 1 && $scope.betConf.customAmountCalc && $scope.betConf.customAmountCalc[$rootScope.env.oddFormat] && (!Config.main.specialOddFormat || !Config.main.specialOddFormat[$rootScope.env.oddFormat] || Config.main.specialOddFormat[$rootScope.env.oddFormat].displayKey[bet.displayKey])) {
                            var customPriceData = $scope.betConf.customAmountCalc[$rootScope.env.oddFormat];
                            if (realPrice > customPriceData.moreThan || realPrice < customPriceData.lessThan) {
                                calcCustomAmountAndTotalStake(bet, realPrice);
                            } else {
                                calcSinglePosWinAndTotalStake(bet, realPrice);
                            }
                        } else {
                            calcSinglePosWinAndTotalStake(bet, realPrice);
                        }

                        possibleWin += parseFloat(bet.singlePosWin);
                        $scope.betSlip.hasCounterOfferError = $scope.counterOffer.enabled && ($scope.betSlip.hasCounterOfferError || bet.singleStake < (($rootScope.profile.counter_offer_min_amount).toFixed($rootScope.currency && $rootScope.currency.rounding || 2)) * 1 || !bet.counterOffer || bet.counterOffer <= bet.price || Number(bet.counterOffer) > Number(bet.maxCounterOffer));
                        if (isCalculateTax) { //Calculate only for tax_type 1 and 20
                            bet.tax = calculateTax(bet.singlePosWin, bet.singleStake);
                        }
                    } else {
                        bet.singlePosWin = 0;
                        if (bet.oddType === 'sp') {
                            $scope.betSlip.totalStake += (bet.singleStake || 0) * (bet.eachWay ? 2 : 1);
                        }
                    }
                    if ($scope.betConf.fullCoverBetTypes.enabled) {
                        totalOdd *= calcBetPrice(bet.price);
                    }
                    break;
                case 2: //express
                    var betPrice = calcBetPrice(bet.price);
                    totalOdd *= betPrice;
                    ewOdd *= bet.ewAllowed && bet.ewCoeff ? mathCuttingFunction(((betPrice - 1) / bet.ewCoeff + 1) * 10 * 10) / 100 : betPrice;
                    break;
                case 3: //system
                    if ($scope.betSlip.sysValArray.length < ($scope.betSlip.bets.length - 2 - $scope.betSlip.bankerBetsCount) && i > 1) {
                        $scope.betSlip.sysValArray.push(i);
                    }
                    break;
                case 4: // chain
                    chainTotalPrice += (convertFractionalPrice(bet.price) - 1);
                    break;
            }


            if ($scope.betSlip.type.value !== 1 && bet.conflicts.length) {
                $scope.betSlip.hasConflicts = true;
            }

            if (sameGameIds[bet.gameId]) {
                $scope.betSlip.hasEventsFromSameGame = true;
            }
            sameGameIds[bet.gameId] = true;

            if (!bet.ewAllowed) {
                $scope.betSlip.eachWayPossible = false;
            }
            if ($scope.betSlip.type.value !== 1 && bet.expMinLen === 1) {
                $scope.betSlip.hasSingleOnlyEvents = true;
            }

            if (bet.blocked) {
                $scope.betSlip.hasLockedEvents = true;
            }

            if (bet.isLive) {
                $scope.betSlip.hasLiveEvents = true;

                if (!Config.betting.allowSuperBetOnLive && $scope.betSlip.superbet.selector) {
                    $scope.betSlip.superbet.selector = false;
                    if (parseInt($scope.shared.acceptPriceChanges, 10) === -1) {
                        $scope.shared.acceptPriceChanges = '0';
                    }
                }

                $scope.counterOffer.enabled && $scope.toggleCounterOffer();
            }

            if (bet.deleted) {
                $scope.betSlip.thereAreDeletedEvents = true;
            }

            if (bet.processing || ($scope.quickBet.enabled && $scope.quickBet.status === 'processing')) {
                $scope.shared.isBetsInProgress = true;
            }

            if (bet.oddType !== 'odd') {
                $scope.betSlip.hasSpOddTypes = true;
            }

            if (bet.banker && bet.price) {
                bankerTotalPrice *= bet.price;
                tmpBankerBetsCount++;
            }

        });

        if ($scope.betSlip.bankerBetsCount !== tmpBankerBetsCount) {
            $scope.betSlip.bankerBetsCount = tmpBankerBetsCount;
            $scope.sysBetSelectedValue = 2;
        }

        if (($scope.betSlip.type.value !== 1 || $scope.quickBet.enabled) && ($scope.betSlip.stake === undefined || $scope.betSlip.stake == "" || parseFloat($scope.betSlip.stake) == 0)) {
            $scope.betSlip.hasEmptyStakes = true;
        }

        if (parseInt($scope.shared.acceptPriceChanges, 10) === -1 && ($scope.betSlip.type.value > 2 || $scope.quickBet.enabled)) {
            $scope.shared.acceptPriceChanges = '0';
        }

        if ($scope.betSlip.bets.length > 0) {
            $scope.betSlip.divisionCoefficient = ($scope.betSlip.type.value === 3 && $scope.calcSystemOptionsCount($scope.sysBetSelectedValue) > 0 ? $scope.calcSystemOptionsCount($scope.sysBetSelectedValue) : 1);
        }

        if (Config.main.enableBetBooking) {
            $scope.betSlip.bookingNotAllowed = ($scope.betSlip.type.value !== 1 && $scope.betSlip.bets.length < 2) || ($scope.betSlip.type.value === 3 && $scope.betSlip.bets.length < 3);
        }

        switch ($scope.betSlip.type.value) {
            case 1:
                if ($scope.betSlip.bets.length === 1 && !Config.betting.alternativeBetSlip && $scope.betSlip.stake && (freeBetSelected('freeBet') || $scope.bonusBet.enabled)) {
                    possibleWin -= $scope.betSlip.stake;
                }

                //full cover type case:
                if ($scope.betConf.fullCoverBetTypes.enabled) {
                    var cache = {}, calcWin;
                    var calculateSysTotalWin = function calculateSysTotalWin(calcRes, amount, ewMode) {
                        var sysWin = 0;
                        if (ewMode) {
                            sysWin = calcRes.win + calcRes.ewWin;
                        } else if ($scope.bonusBet.enabled) {
                            sysWin = bankerTotalPrice * calcRes.win - amount
                        } else {
                            sysWin = bankerTotalPrice * calcRes.win;
                        }
                        return sysWin;
                    };
                    var calcExpressEachWayOdd = function calcExpressEachWayOdd() {
                        return $scope.betSlip.bets.reduce(function(totalEwOdd, currBet) {
                            totalEwOdd *= currBet.ewAllowed && currBet.ewCoeff ? mathCuttingFunction(((convertFractionalPrice(currBet.price) - 1) / currBet.ewCoeff + 1) * 100) / 100 : 1;
                            return totalEwOdd;
                        }, 1);
                    };
                    angular.forEach($scope.fullCoverBet.types, function (type, key) {
                        var cacheKey;
                        var parsedAmount = type.amount && parseFloat(type.amount);
                        if (key !== fullCoverTypesMap[1] && parsedAmount) {
                            // Last two types
                            if (type.systemTuples) {
                                // First we calculate all systems
                                calcWin = type.systemTuples.reduce(function(totalWin, currSystem) {
                                    cacheKey = '' + currSystem[0] + '-' + currSystem[1] + '-' + parsedAmount + '-' + type.ewMode;
                                    if (!cache[cacheKey]) {
                                        var calcResult = calculateSystemPossibleWin(currSystem[0], currSystem[1] * parsedAmount);
                                        cache[cacheKey] = calculateSysTotalWin(calcResult, parsedAmount, type.ewMode);
                                    }
                                    totalWin += cache[cacheKey];
                                    return totalWin;
                                }, 0);

                                // Then the express
                                cacheKey = 'express' + '-' + parsedAmount + '-' + type.ewMode;
                                if (!cache[cacheKey]) {
                                    cache[cacheKey] = type.ewMode ? (totalOdd + calcExpressEachWayOdd()) * parsedAmount : totalOdd * parsedAmount;
                                }
                                calcWin += cache[cacheKey];

                                // Then if necessary singles
                                if (type.includeSingles) {
                                    calcWin += $scope.betSlip.bets.reduce(function(totalAmount, bet) {
                                        var realPrice = $scope.betSlip.betterOddSelectionMode ? bet.betterPrice : ($scope.counterOffer.enabled && bet.counterOffer > bet.price ? bet.counterOffer : (Config.main.decimalFormatRemove3Digit ? parseFloat($filter('oddConvert')(bet.price, 'decimal')): bet.price));
                                        realPrice = convertFractionalPrice(realPrice);
                                        var ewOdd = type.ewMode && bet.ewAllowed && bet.ewCoeff ? mathCuttingFunction(((convertFractionalPrice(bet.price) - 1) / bet.ewCoeff + 1) * 100) / 100 : 0;
                                        totalAmount += (realPrice + ewOdd) * parsedAmount;
                                        return totalAmount;
                                    }, 0);
                                }
                            } else if (type.sysCount) { // System types
                                cacheKey = '' + type.sysCount + '-' + type.count + '-' + parsedAmount + '-' + type.ewMode;
                                if (!cache[cacheKey]) {
                                    var calcResult = calculateSystemPossibleWin(type.sysCount, type.count * parsedAmount);
                                    cache[cacheKey] = calculateSysTotalWin(calcResult, parsedAmount, type.ewMode);
                                }
                                calcWin = cache[cacheKey];
                            } else if (type.totalCoef && totalOdd) { // Express
                                cacheKey = 'express' + '-' + parsedAmount + '-' + type.ewMode;
                                if (!cache[cacheKey]) {
                                    cache[cacheKey] = type.ewMode ? (totalOdd + calcExpressEachWayOdd()) * parsedAmount : totalOdd * parsedAmount;
                                }
                                calcWin = cache[cacheKey];
                            }

                            if (calcWin) {
                                possibleWin += setMaxWinLimit(mathCuttingFunction(calcWin * 1000 || 0) / 1000);
                                if (freeBetSelected('freeBet')) {
                                    possibleWin -= parsedAmount;
                                }
                            }

                            $scope.betSlip.totalStake += parsedAmount * type.count * (type.ewMode ? 2 : 1); // If each way mode is on the stake is doubled
                            $scope.betSlip.hasFilledStake = true;
                        }

                        type.totalCoef !== undefined && (type.totalCoef = mathCuttingFunction(totalOdd * 10 * 10) / 100);
                    });
                }
                //@end full cover case
                break;
            case 2:
                $scope.betSlip.totalStake = $scope.betSlip.stake * ($scope.betSlip.eachWayMode ? 2 : 1);
                if ($rootScope.partnerConfig.max_odd_for_multiple_bet && totalOdd > $rootScope.partnerConfig.max_odd_for_multiple_bet) {
                    totalOdd = $rootScope.partnerConfig.max_odd_for_multiple_bet;
                    if (Config.betting.enableLimitExceededNotifications) {
                        $scope.betSlip.maxOddsWarningAmount = $rootScope.partnerConfig.max_odd_for_multiple_bet;
                    }
                }
                $scope.betSlip.expOdds = mathCuttingFunction(totalOdd * 10 * 10) / 100;
                totalOdd = $scope.betSlip.expOdds;

                $scope.betSlip.expBonus = calculateExpressBonus($scope.betSlip);
                if ($scope.betSlip.expBonus > 0 && $scope.expressBonus.map !== undefined && !$scope.expressBonus.ignoreLowOdds) {
                    $scope.betSlip.expBonusPercentage = $scope.expressBonus.map[$scope.betSlip.bets.length] || $scope.expressBonus.map["default"];
                    $scope.betSlip.expBonusPercentage = $scope.betSlip.expBonusPercentage === -1 ? $scope.betSlip.bets.length : $scope.betSlip.expBonusPercentage;
                }
                if ($scope.betSlip.eachWayMode && ewOdd > 1) {
                    possibleWin = (totalOdd + ewOdd) * $scope.betSlip.stake;
                } else if ($scope.betSlip.stake && (freeBetSelected('freeBet') || $scope.bonusBet.enabled)) {
                    possibleWin = totalOdd * $scope.betSlip.stake - $scope.betSlip.stake;
                } else if ($rootScope.editBet && $rootScope.editBet.edit) {
                    // We use increaseStake.amount instead of .savedAmount, so we calculate possible win before user saves changes
                    possibleWin = totalOdd * ($rootScope.editBet.stakeAmount + parseFloat($rootScope.editBet.increaseStake.amount || 0));
                } else {
                    possibleWin = totalOdd * $scope.betSlip.stake;
                }
                break;
            case 3:
                $scope.betSlip.totalStake = $scope.betSlip.stake * ($scope.betSlip.eachWayMode ? 2 : 1);
                if ($scope.betSlip.bets.length > 2) {
                    var tempResult = calculateSystemPossibleWin();
                    $scope.betSlip.sysOptions = tempResult.options;
                    if ($scope.betSlip.eachWayMode) {
                        possibleWin = tempResult.win + tempResult.ewWin;
                    } else if ($scope.betSlip.stake && $scope.bonusBet.enabled) {
                        possibleWin = bankerTotalPrice * tempResult.win - $scope.betSlip.stake;
                    } else {
                        possibleWin = bankerTotalPrice * tempResult.win;
                    }
                }
                break;

            case 4:
                if ($scope.betSlip.stake) {
                    possibleWin = Number((parseFloat($scope.betSlip.stake) + (chainTotalPrice * $scope.betSlip.stake))).toFixed(2);
                }
                $scope.betSlip.eachWayPossible = false;
                break;

            default:
                possibleWin = 0;
                break;
        }

        if (!$scope.betSlip.eachWayPossible) {
            $scope.betSlip.eachWayMode = false;
        }

        if (Config.betting.showNetWinning && Config.betting.showNetWinning.enabled) {
            var showNetWinning = Config.betting.showNetWinning;
            var dontShowNetWinning;
            // Making sure the correct odd type is set
            if (showNetWinning.oddTypes && showNetWinning.oddTypes.length && showNetWinning.oddTypes.indexOf($rootScope.env.oddFormat) === -1) {
                dontShowNetWinning = true;
            }
            // Making sure only the specified markets are in the betslip
            if (!dontShowNetWinning && showNetWinning.marketTypes && showNetWinning.marketTypes.length) {
                for (var i = 0, length = $scope.betSlip.bets.length; i < length; ++i) {
                    if (!$scope.betSlip.bets[i].marketType || showNetWinning.marketTypes.indexOf($scope.betSlip.bets[i].marketType) === -1) {
                        dontShowNetWinning = true;
                        break; // No need to iterate if even one event had market type different from what we specified in the config
                    }
                }
            }
            // If every condition is met we show the net winning
            if (!dontShowNetWinning) {
                possibleWin -= $scope.betSlip.stake;
            }
        }

        $scope.betSlip.isBettingAllowed = checkIfBettingIsAllowed();

        if ($scope.profitBoost.selected) {
            $scope.profitBoost.selected.posBoost = possibleWin * $scope.profitBoost.selected.amount_percent / 100;
            possibleWin += $scope.profitBoost.selected.posBoost;
        }

        if($scope.taxOnStake.enabled) {
            $scope.taxOnStake.tax = $scope.betSlip.stake * ($rootScope.partnerConfig.tax_percent) / 100;
            $scope.taxOnStake.total = $scope.betSlip.stake - $scope.taxOnStake.tax;
            $scope.taxOnStake.posWin = possibleWin - (possibleWin * $rootScope.partnerConfig.tax_percent)/100;
        }

        if ($scope.betSlip.expBonus) {
            $scope.totalPossibleWin = $scope.taxOnStake.enabled ? $scope.betSlip.expBonus + $scope.taxOnStake.posWin : parseFloat(possibleWin + $scope.betSlip.expBonus).toFixed(2);
        }

         finalWinValue = parseFloat(setMaxWinLimit(mathCuttingFunction(possibleWin * 10 * 10 || 0) / 100));
        if (isCalculateTax) { // calculate only for tax_type 1,2,20
            if ($scope.betSlip.expBonus && $scope.betSlip.type.value === 2) { //checking is express bet
                $scope.possibleWinBonusTax = calculateTax(finalWinValue + $scope.betSlip.expBonus, $scope.betSlip.stake);
                $scope.finalWinBonusTaxValue = $scope.totalPossibleWin - ({1: 1, 2: 1}[$rootScope.partnerConfig.tax_type] ? $scope.possibleWinBonusTax : 0);
            } else {
                $scope.possibleWinTax = calculateTax(finalWinValue, $scope.betSlip.stake);
                $scope.finalWinTaxValue = finalWinValue - ({1: 1, 2: 1}[$rootScope.partnerConfig.tax_type] ? $scope.possibleWinTax : 0);
            }
        }
        return finalWinValue;
    };

    function checkIfBettingIsAllowed() {
        return !(
            ($scope.betSlip.type.value !== 1 && ($scope.betSlip.bets.length < 2 || $scope.betSlip.hasSingleOnlyEvents)) ||
            ($scope.betSlip.type.value !== 1 && (isNaN($scope.betSlip.stake) || !$scope.betSlip.stake)) ||
            ($scope.betSlip.type.value === 1 && $scope.betSlip.hasEventsFromSameGame && Config.betting.blockSingleGameBets) ||
            ($scope.betSlip.type.value === 3 && $scope.betSlip.bets.length < 3) ||
            ($scope.betSlip.type.value === 3 && $scope.betSlip.bets.length > 16) || // System bet restriction (max 16 events)
            (Config.betting.enableBankerBet && $scope.betSlip.bets.length - $scope.betSlip.bankerBetsCount < 2) ||
            ($scope.betSlip.hasEmptyStakes && !$scope.betSlip.hasFilledStake) ||
            $scope.betSlip.hasLockedEvents  ||
            $scope.betSlip.hasConflicts
        );
    }

    $scope.$on('bet', addBet);

    /**
     * @ngdoc method
     * @name setBetSlipType
     * @methodOf betting.controller:betSlipController
     * @description sets betslip type

     * @param {object} type betslip type, one of the following: single, express, system, chain
     * @param {boolean} notCheckForFreeBet
     */
    $scope.setBetSlipType = function setBetSlipType(value, notCheckForFreeBet) {
        var canSet = false;
        for (var i = 0, x = $scope.betTypes.length; i < x; i++) {
            if ($scope.betTypes[i].value === value) {
                canSet = true;
                $scope.betSlip.type = $scope.betTypes[i];
                break;
            }
        }
        if (!canSet) { return; }

        $scope.betSlip.bookingResultIds = []; // Removing booking print button, because bet slip type has changed;

        var changeOddFormatForBetslipType = Config.main.asian.changeOddFormatForBetslipType;
        //Added functionality for changing odd format from indo or malay into hongkong when placing multiple or system bet
        if (changeOddFormatForBetslipType !== undefined &&  changeOddFormatForBetslipType[$scope.betSlip.type.name] !== undefined && changeOddFormatForBetslipType[$scope.betSlip.type.name][$rootScope.env.oddFormat] !== undefined) {
            $rootScope.env.oddFormat = changeOddFormatForBetslipType[$scope.betSlip.type.name][$rootScope.env.oddFormat];
        }
        //broadcast event about new type
        Config.main.disableOddFormatsSpecialCase && $rootScope.$broadcast('betslip.type', $scope.betSlip.type);

        Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
        if (parseInt($scope.shared.acceptPriceChanges, 10) === -1 && $scope.betSlip.type.value > 2) {
            $scope.shared.acceptPriceChanges = '0';
        }
        !notCheckForFreeBet && (checkFreeBet());

        if ($scope.betSlip.type.value !== 1) {
            $scope.counterOffer.enabled = false;
        }
    };

    /**
     * @ngdoc method
     * @name setSystemValue
     * @methodOf betting.controller:betSlipController
     * @param {Number} val selected value
     * @description sets system selected value
     */

    $scope.setSystemValue = function setSystemValue(val) {
        $scope.sysBetSelectedValue = val;
    };

    /**
     * @ngdoc method
     * @name openLoginForm
     * @methodOf betting.controller:betSlipController
     * @description broadcasts a message to open slider with login form
     *
     * @param {Object} $event click event
     */
    $scope.openLoginForm = function openLoginForm($event) {
        $rootScope.$broadcast("openLoginForm");
        $event.stopPropagation();
    };

    /**
     * @ngdoc method
     * @name openRegisterForm
     * @methodOf betting.controller:betSlipController
     * @description broadcasts a message to open slider with register form
     *
     * @param {Object} $event click event
     */
    $scope.openRegForm = function openRegForm($event) {
        $rootScope.$broadcast("openRegForm");
        $event.stopPropagation();
    };

    /**
     * @ngdoc method
     * @name deposit
     * @methodOf betting.controller:betSlipController
     * @description calls partner callback function to open deposit page(integration mode)
     */
    $scope.openPartnerDeposit = function openPartnerDeposit() {
        partner.call('deposit', 'betslip');
    };

    /**
     * @ngdoc method
     * @name gotoBetGame
     * @methodOf betting.controller:betSlipController
     * @description  Navigates to Events game
     *
     * @param {Object} gamePointer game object
     */
    $scope.gotoBetGame = function gotoBetGame(gamePointer) {
        var search = {
            'type': gamePointer.isLive,
            'sport': gamePointer.sport.id !== undefined ? gamePointer.sport.id : gamePointer.sport,
            'region': gamePointer.region,
            'competition': gamePointer.competition,
            'game': gamePointer.game,
            'vsport': gamePointer.vsport
        };

        $location.search(search);
        if (gamePointer.alias && Config.main.sportsLayout === 'Combo' && gamePointer.sport !== - 3) {
            $location.search('alias', gamePointer.alias);
        }
        var getVirtualPath = function () {
            var virtualsPath = '/virtualsports';
            angular.forEach(Config.main.virtualSportIds, function (value, key) {
                value.indexOf(gamePointer.vsport) !== -1 && (virtualsPath = key);
            });
            return virtualsPath;
        };

        var neededPath = gamePointer.path || ( gamePointer.sport === -3 ? getVirtualPath() : Utils.getPathAccordintToAlias(gamePointer.alias) );

        if ($location.path() !== neededPath + '/') {
            $location.path(neededPath);
        } else {
            $route.reload();
        }
    };

    /**
     * @ngdoc method
     * @name betFromKeyboard
     * @methodOf betting.controller:betSlipController
     * @description  Place Bet by pressing Enter key on keyboard
     * @param {Object} $event keypress event
     */

    $scope.betFromKeyboard = function betFromKeyboard($event) {

        if (Config.betting.disableBetFromKeyboard) {
            return;
        }
        $scope.betSlip.hasEmptyStakes = ($scope.betSlip.type.value !== 1 || $scope.quickBet.enabled) && ($scope.betSlip.stake === "" || parseFloat($scope.betSlip.stake) === 0);

        if ($event.keyCode === 13 && !( !$scope.betSlip.isBettingAllowed || !$scope.env.authorized || $scope.shared.isBetsInProgress || $scope.betSlip.thereAreDeletedEvents || $scope.betSlip.hasCounterOfferError || ($scope.env.authorized && !$scope.freeBet.enabled && $scope.betSlip.totalStake > $scope.profile.balance + $scope.profile.bonus_balance + ($scope.profile.bonus_win || 0)))) {
            $scope.acceptChangesAndPlaceBets();
        }
    };

    /**
     * @ngdoc function
     * @name getDisplayBase
     * @methodOf betting.controller:betSlipController
     * @description returns base to display
     *
     * @param {Object} bet bet object
     * @param {Boolean} initial true to display initial base, false for current
     *
     * @returns {String} base to display
     */
    $scope.getDisplayBase = function getDisplayBase(bet, initial) {
        var baseFieldName = initial ? 'baseInitial' : 'base';
        var prefix = (bet.marketType && bet.marketType.substr(-8) === 'Handicap' && bet[baseFieldName] > 0 ? '+' : '');

        return prefix + bet[baseFieldName];
    };

    $scope.goToTop = DomHelper.goToTop;

    /**
     * @ngdoc method
     * @name openBookingPrintPopup
     * @methodOf betting.controller:betSlipController
     * @description show booking print popup
     */
    $scope.openBookingPrintPopup = function openBookingPrintPopup() {
        var betData = {
            'currencyName': $rootScope.currency_name || $rootScope.currency && $rootScope.currency.name,
            'bets': $scope.betSlip.bets,
            'amount': $scope.betSlip.stake * ($scope.betSlip.eachWayMode ? 2 : 1),
            'betType': $scope.betSlip.type.value,
            'sysVal': $scope.sysBetSelectedValue,
            'bookIds': $scope.betSlip.bookingResultIds,
            'viewType': Config.main.bookingBetPrint.viewType,
            'odds': $scope.betSlip.type.value === 1 ? $scope.betSlip.bets[0].price : $scope.betSlip.expOdds,
            'oddFormat': $rootScope.env.oddFormat,
            'balanceFractionSize': $rootScope.conf.balanceFractionSize,
            'possibleWin': $scope.possibleWinValue,
            'possibleWinTax': $scope.possibleWinTax,
            'finalWinTaxValue': $scope.finalWinTaxValue,
            'totalPossibleWin': $scope.totalPossibleWin,
            'possibleWinBonusTax': $scope.possibleWinBonusTax,
            'finalWinBonusTaxValue': $scope.finalWinBonusTaxValue,
            'date': Moment.get().unix()
        };
        if ($scope.expressBonus.enabled) {
            betData['enableExpressBonus'] = true;
            betData['expressBonusVisibilityQty'] = $scope.expressBonus.visibilityQty;
            betData['expBonusPercentage'] = $scope.betSlip.expBonusPercentage;
            betData['expBonus'] = $scope.betSlip.expBonus;
            betData['expOdds'] = $scope.betSlip.expOdds;
            betData['hasSpOddTypes'] = $scope.betSlip.hasSpOddTypes;
        }
        if ($rootScope.partnerConfig && $rootScope.partnerConfig.tax_type && $rootScope.partnerConfig.tax_percent) {
            betData['tax'] = {
                'type': $rootScope.partnerConfig.tax_type,
                'percent': $rootScope.partnerConfig.tax_percent
            };
        }
        var encodedBetData = encodeURIComponent(JSON.stringify(betData));

        if (encodedBetData.length > 1020 && UserAgent.IEVersion()) {
            Storage.set('printPreview', encodedBetData);
            encodedBetData = '';
        }

        $window.open($window.document.location.pathname + "#/popup/?action=booking&data=" + encodedBetData, "_blank", "toolbar=no, scrollbars=no, resizable=no, width=700, height=500");
    };

    /**
     * @ngdoc method
     * @name bookIdPopup
     * @methodOf betting.controller:betSlipController
     * @param {Array} ids
     * @description show booking popup
     */
    $scope.bookIdPopup = function bookIdPopup(ids) {
        if (Config.main.enableBetBookingPopup) {
            $rootScope.$broadcast("globalDialogs.addDialog", {
                title: 'bet slip',
                type: 'info',
                content: Translator.get(ids.length > 1 ? 'Your Booking IDs are:' : 'Your Booking ID is:'),
                contentBox: ids.toString(),
                showCustomButton: Config.main.bookingBetPrint.showPrintButton
            });
        }
    };

    /**
     * @ngdoc method
     * @name specialRounding
     * @methodOf betting.controller:betSlipController
     * @param {Number} num value
     * @description special rounding based on odd even values
     */
    $scope.specialRounding = function specialRounding(num) {
        return num % 1 === 0.5 ? (Math.floor(num) % 2 === 0 ? Math.floor(num) : Math.ceil(num)) : Math.round(num);
    };

    /**
     * @ngdoc method
     * @name toggleBetterOddSelectionMode
     * @methodOf betting.controller:betSlipController
     */
    $scope.toggleBetterOddSelectionMode = function toggleBetterOddSelectionMode () {
        if ($scope.betSlip.betterOddSelectionMode) {
            $scope.setBetSlipType(1, false);
        }
        Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
    };

    /**
     * @ngdoc method
     * @name toggleCounterOffer
     * @methodOf betting.controller:betSlipController
     */
    $scope.toggleCounterOffer = function toggleCounterOffer () {
        if (!$scope.betSlip.counterOfferPossible) { return; }
        $scope.counterOffer.enabled = !$scope.counterOffer.enabled;

        if ($scope.counterOffer.enabled) {
            $scope.betSlip.superbet.selector = false;
            $scope.setBetSlipType(1, true);
        } else {
            $scope.betSlip.hasCounterOfferError = false;
        }
    };

    /**
     * @ngdoc method
     * @name togglesSuperbetSelector
     * @methodOf betting.controller:betSlipController
     */
    $scope.togglesSuperbetSelector = function togglesSuperbetSelector () {
        if (!$rootScope.profile.is_super_bet_available || !$scope.betSlip.superbet.possible) return;
        $scope.betSlip.superbet.selector = !$scope.betSlip.superbet.selector;
        if ($scope.betSlip.superbet.selector) {
            $scope.betSlip.mode = 'betting'; // switching to the betting mot
            disableFreeBet('freeBet');
            disableFreeBet('profitBoost');
            $scope.counterOffer.enabled = false;
            $scope.shared.acceptPriceChanges = '-1';
        } else {
            $scope.shared.acceptPriceChanges = '0';
        }
        $scope.shared.showBetSettings = false;
        Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
    };

    /**
     * @ngdoc method
     * @name showInfo
     * @methodOf betting.controller:betSlipController
     * @description Shows information dialog for better bet and counter offer
     * @param {String} betterBet or counterOffer
     */
    $scope.showInfo = function showInfo (source) {
        var content;
        switch (source) {
            case "betterBet":
                content = "You have a chance to apply for a higher than the existing odd for an event and submit the query which may be approved or declined by our traders.";
                break;
            case "counterOffer":
                content = "counter_offer_description";
                break;
            default:
                break;
        }
        if (content) {
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'info',
                title: 'Information',
                content: content
            });
        }
    };

    /**
     * @ngdoc object
     * @methodOf betting.controller:betslipCtrl
     * @description hide quick bet when there isn't single bet type
     */

    if (!$scope.betConf.quickBet.hideQuickBet && $scope.betTypes.length) {
        var hideQuickBet = true;
        angular.forEach($scope.betTypes, function (b) {
            if (b.name === 'single') {
                hideQuickBet = false;
            }
        });
        $scope.betConf.quickBet.hideQuickBet = hideQuickBet;
    }

    /**
     * @ngdoc method
     * @name singleBetTypeAmountChange
     * @methodOf betting.controller:betSlipController
     * @description checks and fill  amount of 'singles'   in full cover types
     */
    $scope.singleBetTypeAmountChange = function singleBetTypeAmountChange() {
        if ($scope.betConf.fullCoverBetTypes.enabled && $scope.betSlip.bets.length > 1) {
            var i = 1, length = $scope.betSlip.bets.length, currentAmount = $scope.betSlip.bets[0].singleStake;
            for (; i < length; ++i) {
                if (currentAmount !== $scope.betSlip.bets[i].singleStake) {
                    $scope.fullCoverBet.types[fullCoverTypesMap[1]].amount = "";
                    return;
                }
            }
            $scope.fullCoverBet.types[fullCoverTypesMap[1]].amount = currentAmount;
        }
    };

    /**
     * @ngdoc method
     * @name fullCoverTypeAmountChange
     * @methodOf betting.controller:betSlipController
     * @description Handles single's type amount change and applies for all events
     * @param {String} key the key of current type of full cover types
     * @param {String} the current amount of current type
     */
    $scope.fullCoverTypeAmountChange = function fullCoverTypeAmountChange(key, amount) {
        if (key === fullCoverTypesMap[1]) {
            $scope.repeatSingleStake(amount);
        }
    };

    /**
     *@description recalculates all possible types if full cover bet types enabled from config
     */
    function calculateFullCoverTypes(newLength) {
        if (!newLength || newLength < 2) {
            $scope.fullCoverBet.types = {};
        } else {
            var i = 1, key, lastCount = 0, newTypes = {};
            for (; i <= newLength;  ++i) {
                key  = fullCoverTypesMap[i] || i + fullCoverTypesMap['default'];
                newTypes[key] = $scope.fullCoverBet.types[key] || {
                    order: i,
                    amount: '',
                    name: fullCoverTypesMap[i] && Translator.get(fullCoverTypesMap[i]) || (i + ' ' + Translator.get(fullCoverTypesMap["default"]))
                };
                newTypes[key].ewMode = false;
                if (i > 1) {
                    newTypes[key].count = $scope.calcSystemOptionsCount(i);
                    lastCount += newTypes[key].count;

                    if (newTypes[key].count === 1) {
                        newTypes[key].totalCoef = 1; // will be calculated inside posWin
                        newTypes[key].type = 2; // actually this is system bet
                        newTypes[key].sysCount && (delete newTypes[key].sysCount);

                    } else {
                        newTypes[key].sysCount = i;
                        newTypes[key].type = 3; // actually this is system bet
                        newTypes[key].totalCoef && (delete newTypes[key].totalCoef);
                    }

                } else {
                    newTypes[key].count = newLength;
                }
            }

            if (newLength > 2 && newLength <= 8) {
                var systemTuples = [];
                angular.forEach(newTypes, function(type) {
                    if (type.sysCount) {
                        systemTuples.push([type.sysCount, type.count]);
                    }
                });
                var fullCoverLastItems = fullCoverAdditionalTypesMap[newLength];
                fullCoverLastItems.forEach(function(fullCoveredType) {
                    var key = fullCoveredType.name;
                    newTypes[key] = $scope.fullCoverBet.types[key] || {
                        order: i++,
                        amount: '',
                        name: Translator.get(fullCoveredType.name),
                        type: fullCoveredType.type,
                        count: fullCoveredType.includeSingles ? lastCount + newLength : lastCount,
                        includeSingles: fullCoveredType.includeSingles,
                        systemTuples: systemTuples,
                        ewMode: false
                    };
                });
            }

            $scope.fullCoverBet.types = newTypes;

            // need to check and fill single type amount
            $scope.singleBetTypeAmountChange();
        }
    }

    /**
     * @ngdoc method
     * @name addSelections
     * @methodOf betting.controller:betSlipController
     * @description add new selections
     */
    $scope.addSelections = function addSelections(showSelectionsPart) {
        var onlyOriginalEvent;
        $scope.disableAddBets.newSelections = true;
        //if param showSelectionsPart is true => clicked on 'Add to bet' button
        if(showSelectionsPart) {
            $rootScope.editBet.openSelectionsPart = true;
            $scope.showInSelections = true;
            $scope.disableAddBets.addBet = false;
            $scope.disableAddBets.saveChanges = true;
            $scope.emptyNewSelections = true;
        } else {
            //if param showSelectionsPart is undefined => clicked on 'Add selection' button, it opens new selections part
            $rootScope.editBet.openSelectionsPart = false;
            $scope.disableAddBets.addBet = true;
        }

        angular.forEach($scope.betSlip.bets, function(bet) {
            if (bet.showInSelections) {
                bet.showInSelections = false;
            }
            if (bet.originalEvent) {
                bet.addedFromEditBet = false;
                onlyOriginalEvent = $rootScope.editBet.originalEventIds.length === $scope.betSlip.bets.length && (onlyOriginalEvent === undefined || onlyOriginalEvent === true);
            } else {
                bet.addedFromEditBet = true;
                onlyOriginalEvent = false;
            }
        });

        if (typeof onlyOriginalEvent !== 'undefined') {
            $rootScope.editBet.changed = !onlyOriginalEvent;
            // If there is a saved stake amount we keep the 'Save Changes' button enabled, if not - we check whether or not there is only the original event(s) in the bet slip
            $scope.disableAddBets.saveChanges = $rootScope.editBet.increaseStake.savedAmount ? false : onlyOriginalEvent;
        }
        Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
    };


    /**
     * @ngdoc method
     * @name toggleStakeTooltip
     * @methodOf betting.controller:betSlipController
     * @description Toggles increase stake tooltip when in edit bet mode
     * @param {Boolean} saveChanges - if true, saves increased stake amount
     */
    $scope.toggleStakeTooltip = function toggleIncStakeTooltip(saveChanges) {
        if (saveChanges && $scope.betSlip.totalStake - $rootScope.editBet.stakeAmount > $scope.profile.calculatedBalance + $scope.profile.calculatedBonus) { return; }

        $rootScope.editBet.increaseStake.tooltip = !$rootScope.editBet.increaseStake.tooltip;
        if (saveChanges) {
            $rootScope.editBet.increaseStake.savedAmount = parseFloat($rootScope.editBet.increaseStake.amount);
            $scope.disableAddBets.saveChanges = $rootScope.editBet.changed ? $scope.disableAddBets.saveChanges : !$rootScope.editBet.increaseStake.savedAmount;
        }

        if (!$rootScope.editBet.increaseStake.tooltip && parseFloat($rootScope.editBet.increaseStake.savedAmount) !== parseFloat($rootScope.editBet.increaseStake.amount)) {
            $rootScope.editBet.increaseStake.amount = $rootScope.editBet.increaseStake.savedAmount;
        }
    };


    /**
     * @ngdoc method
     * @name removeNewSelectionsFromBetSlip
     * @methodOf betting.controller:betSlipController
     * @description removes new selections from betSlip
     */
    $scope.removeNewSelectionsFromBetSlip = function removeNewSelectionsFromBetSlip() {
        $rootScope.editBet.openSelectionsPart = false;
        $scope.disableAddBets.saveChanges = !($rootScope.editBet.changed || $rootScope.editBet.increaseStake.savedAmount);
        $scope.disableAddBets.addBet = true;
        angular.forEach($scope.betSlip.bets, function(bet) {
            if(bet.showInSelections) {
                $scope.betSlip.bets.splice($scope.betSlip.bets.indexOf(bet));
            }
        });
        Storage.set('betslip', $scope.betSlip, Config.betting.storedBetslipLifetime);
    };

    if ($scope.betConf.fullCoverBetTypes.enabled) {
        $scope.$watch('betSlip.bets.length', calculateFullCoverTypes);

        $scope.betSlip.type.value !== 1 && $scope.setBetSlipType(1, false);
    }


    /**
     * @ngdoc function
     * @name lookForEventsInURL
     * @methodOf betting.controller:betSlipController
     * @description Looks for event ids and stake in the url and adds them to bet slip
     */
    function lookForEventsInURL() {
        var params = $location.search();
        if (params.event && typeof params.event === 'string') {
            var eventIds;
            if (params.event.indexOf(',') > 0) {
                eventIds = Utils.uniqueNum(params.event.split(','))
            } else if (!isNaN(Number(params.event))) { // Checking if the url format is correct (e.g. event=,41545315 is wrong)
                eventIds = [Number(params.event)];
            }
            if (eventIds) {
                $location.search('event', undefined);
                BetService.getEventData(eventIds).then(function success(response) {
                    if (response.data) {
                        var betsToPlace = Utils.formatEventData(response.data),
                            oddType = 'odd';
                        $scope.clearBetslip();
                        for (var i = 0; i < betsToPlace.length; i++) {
                            $rootScope.$broadcast('bet', {event: betsToPlace[i].eventInfo, market: betsToPlace[i].marketInfo, game: betsToPlace[i].gameInfo, oddType: oddType});
                        }
                        if (params.stake && typeof params.stake === 'string' && !isNaN(Number(params.stake))) {
                            $scope.betSlip.stake = Number(params.stake);
                            $location.search('stake', undefined);
                        }
                    }
                })
            }
        }
    }


    var currency = ($rootScope.profile && $rootScope.profile.currency_name) || Config.main.registration.defaultCurrency;

    function getFavoriteStakes() {
        if (!$scope.betConf.enableFavoriteStakes) {
            return;
        }
        if (!($rootScope.partnerConfig && $rootScope.partnerConfig.min_bet_stakes)) {
            var partnerConfigWatcher = $scope.$on('partnerConfig.updated', function () {
                partnerConfigWatcher();
                if ($rootScope.partnerConfig.min_bet_stakes) {
                    getFavoriteStakes();
                }
            });
        }

        currency = ($rootScope.profile && $rootScope.profile.currency_name) || Config.main.registration.defaultCurrency;
        var min_bet = parseFloat($rootScope.partnerConfig && $rootScope.partnerConfig.min_bet_stakes && $rootScope.partnerConfig.min_bet_stakes[currency]) || 0.1;

        $scope.favoriteStake = {
            values: [],
            editMode: false
        };

        var storage_stakes = Storage.get('favorite_stake_' + currency);

        if (storage_stakes) {
            $scope.favoriteStake.values = storage_stakes;
        } else {
            for (var i = 0; i < $scope.betConf.favoriteStakesMultipliers.length; i++) {
                $scope.favoriteStake.values[i] = ($scope.betConf.favoriteStakesMultipliers[i] * min_bet);
            }
        }
    }

    $scope.setFavoriteStake = function (value) {
        if($scope.betSlip.bets.length > 2 && $scope.betSlip.type.value === 3){
            $scope.betSlip.unitStake = value;
        }else if($scope.betSlip.bets.length > 1 && $scope.betSlip.type.value === 1){
            $scope.betSlip.bets.forEach(function (bet) {
               bet.singleStake = value.toString();
            });
        }else{
            $scope.betSlip.stake = value;
        }
    };


    $scope.saveFavoriteStakes = function () {
        if($scope.favoriteStake.values.every(function (value) { return value;})){
            $scope.favoriteStake.editMode = false;
            Storage.set('favorite_stake_' + currency, $scope.favoriteStake.values);
        }
    };
    $scope.editFavoriteStakes = function () {
        $scope.favoriteStake.editMode = true;
        setTimeout(function () {
            $window.document.getElementById('favorite-stake-input-0').focus();
        }, 10)
    };


    (function init() {
        getFavoriteStakes();
        lookForEventsInURL();
        BetService.getExpressBonusRules().then(function (response) {
            $scope.expressBonus = response;
        });
    })();


    $scope.$on("openBetBookingPrintPopup", function() {
        $scope.openBookingPrintPopup();
    });

    $scope.$on('close.edit.mode', function() {
        $scope.showInSelections = false;
        $scope.emptyNewSelections = true;
        $scope.disableAddBets = {
            newSelections: false,
            addBet: false,
            saveChanges: true
        };
    });
    $scope.$on('clear.bets',function(event, editBet) {if($scope.showRetainsButtons || editBet) { $scope.clearBetslip() }});
    $scope.$on('disable.add.bet', function() {$scope.disableAddBets.addBet = true});
    $scope.$on('$destroy', function() {
        if (subId) {
            Zergling.unsubscribe(subId);
            subId = undefined;
        }
        if ($rootScope.editBet && $rootScope.editBet.edit) {
            // Need the timeout to keep edit bet if user is switching Sports' sub headers (e.g. 'Event View', 'Dashboard', etc.)
            $rootScope.editBet.unsubPromise = $timeout(cancelEditBet, 1500);
        }
    })

}]);
