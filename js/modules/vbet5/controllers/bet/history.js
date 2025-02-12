/* global VBET5 */
/**
 * @ngdoc controller
 * @name vbet5.controller:myBetsCtrl
 * @description
 *  bet history controller.
 */
VBET5.controller('myBetsCtrl', ['$scope', 'Utils', 'ConnectionService', 'Zergling', 'Moment', 'Translator', 'Config', 'GameInfo', '$rootScope', '$window', '$filter', '$timeout', '$location', 'BetService', function ($scope, Utils, ConnectionService, Zergling, Moment, Translator, Config, GameInfo, $rootScope, $window, $filter, $timeout, $location, BetService) {
    'use strict';
    $scope.BETS_TO_SHOW = Config.main.countOfRecentBetsToShow;
    $scope.offset = 0;
    $scope.allBetsCount = 0;
    $scope.myBetsLoaded = false;
    $scope.betHistoryLoaded = false;
    $scope.monthIndexes = [];
    $scope.ODD_TYPE_MAP = ['decimal', 'fractional', 'american', 'hongkong', 'malay', 'indo'];
    $scope.betStatusFilter = undefined;
    $scope.poolBettingMap = {
        '1': Translator.get('W1'),
        '2': 'X',
        '3': Translator.get('W2')
    };

    $scope.profit = {
        show: false,
        result: 0
    };

    if (!$rootScope.gamePointers) {
        $rootScope.gamePointers = {};
    }
    var betHistory, BETS_PER_HISTORY_PAGE = 6;
    var sliderContentWatcherPromise;

    $scope.betHistoryParams = {
        dateRanges: [],
        dateRange: null,
        betType: '-1',
        outcome: '-1',
        betIdFilter: null,
        type: -1,
        category: '0',
        game: '0'

    };
    var allBets;
    var cashOutSubId;

    $scope.minCashoutValue = BetService.cashOut.getMinCashOutValue();


    /**
     * @ngdoc method
     * @name getVisibleBets
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  Returns visible bets only
     * @param {Array} bets bets array
     */
    function getVisibleBets(bets) {
        return bets.slice($scope.offset, $scope.offset + $scope.BETS_TO_SHOW);
    }

    /**
     * @ngdoc method
     * @name convertStringFiledsToNumbers
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Convert string fileds to numbers
     * @param {Object} array
     */
    function convertStringFiledsToNumbers(arr) {
        arr.map(function (bet) { //convert string fields to numbers
            ['amount', 'bonus', 'bonus_amount', 'bonus_bet_amount', 'payout', 'possible_win', 'bonus_possible_win'].map(function (field) {
                bet[field] = parseFloat(bet[field]);
                bet[field] = isNaN(bet[field]) ? 0 : bet[field];
            });
        });
    }


    /**
     * @ngdoc method
     * @name fixBetItemNames
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  fixes game and event names in given bets (converts html entities to symbols)
     * @param {Object} bets bets array
     */
    function fixBetItemNames(bets) {
        bets.map(function (bet) {
            if (bet) {
                bet.oddTypeMapped = $scope.ODD_TYPE_MAP[+bet.odd_type];
                angular.forEach(bet.events, function (event) {
                    event.game_name =  Utils.convertHtmlEntitiesToSymbols(event.game_name);
                    event.event_name = Utils.convertHtmlEntitiesToSymbols(event.event_name);
                });
            }
        });
    }

    /**
     * @ngdoc method
     * @name calculateLiability
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  Calculate Liability
     * @param {Object} bets bets array
     */
    function calculateLiability(bets) {
        angular.forEach(bets, function (bet) {
            switch (bet.type) {
                case 0:
                case '0':
                    bet.liability = $filter('number')((parseFloat(bet.k) - 1) * parseFloat(bet.amount), 2);
                    break;
                case 1:
                case '1':
                    bet.liability = $filter('number')(parseFloat(bet.amount), 2);
                    break;
                default:
                    bet.liability = '...';
                    break;
            }

        });
    }

    /**
     * @ngdoc method
     * @name factorial
     * @methodOf betting.controller:myBetsCtrl
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
     * @name calculateSystemCombinations
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  Calculate Liability
     * @param {Object} bets bets array
     */
    function calculateSystemCombinations(bets) {
        angular.forEach(bets, function (bet) {
            if (bet.type === 3) {
                var total = bet.events.length, k = bet.system_min_count;
                bet.systemCombinationsCount = Math.round(factorial(total) / (factorial(k) * factorial(total - k)));
            }
        });
    }



    /**
     * @ngdoc method
     * @name filterCashoutBet
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  filters bets with cashout only
     * @param {Object} bets bets array
     */
    function filterCashoutBet(bets) {
        var betsCashout = [];
        angular.forEach(bets, function (val) {
            if (val.cash_out && val.cash_out !== 0 && val.cash_out !== '0') {
                betsCashout.push(val);
            }
        });
        return betsCashout;
    }

    /**
     * @ngdoc method
     * @name fillBetsPointerInfo
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  get game regions and fill game Pointer info
     *
     * @param {Object} currentBets
     */
    function fillBetsPointerInfo(currentBets) {
        var betGameIdsObj = {};
        $rootScope.gamePointers = {};
        angular.forEach(currentBets, function (bet) {
            angular.forEach(bet.events, function (betEvent) {
                if (betEvent.game_id && !isNaN(betEvent.game_id)) {
                    betGameIdsObj[betEvent.game_id] = parseInt(betEvent.game_id, 10);
                }
            });


            if (Config.betting.popupMessageAfterBet &&
                Config.betting.popupMessageAfterBet.startTime &&
                bet.amount >= Config.betting.popupMessageAfterBet[bet.currency] &&
                bet.bonus_bet_amount === 0 /*non freebet */ &&
                (!Config.betting.popupMessageAfterBet.outcomeInclude || (Config.betting.popupMessageAfterBet.outcomeInclude && Config.betting.popupMessageAfterBet.outcomeInclude.split(',').indexOf(bet.outcome.toString()) !== -1))
            ) {
                var diffStart = Moment.get(Moment.moment.unix(bet.date_time)).diff(Moment.moment.utc(Config.betting.popupMessageAfterBet.startTime), 'seconds');
                var diffEnd = Moment.get(Moment.moment.unix(bet.date_time)).diff(Moment.moment.utc(Config.betting.popupMessageAfterBet.endTime), 'seconds');
                if (diffStart > 0 && diffEnd < 0) {
                    bet.showBetDrawIcon = true;
                    $scope.betDrawIconTitle = Config.betting.popupMessageAfterBet.tooltip;
                }
            }
        });

        var betGameIds = Utils.objectToArray(betGameIdsObj);
        var request = {
            'source': 'betting',
            'what': {
                'sport': ['id', 'alias', 'type'],
                'region': ['id'],
                'competition': ['id'],
                'game': ['id', 'type']
            },
            'where': {
                'game': {
                    'id': {'@in': betGameIds}
                },
                'sport': {'type': {'@ne': 1}} /* no virtual sports */
            }
        };
        if (betGameIds.length > 0) {
            Zergling.get(request).then(function (result) {
                if (result.data && result.data.sport) {
                    angular.forEach(result.data.sport, function (sport) {
                        angular.forEach(sport.region, function (region) {
                            angular.forEach(region.competition, function (competition) {
                                angular.forEach(competition.game, function (game) {
                                    angular.forEach(currentBets, function (bet) {
                                        angular.forEach(bet.events, function (betEvent) {
                                            if (betEvent.game_id == game.id) {
                                                $rootScope.gamePointers[betEvent.game_id] = {
                                                    'game': betEvent.game_id,
                                                    'sport': sport,
                                                    'competition': competition.id,
                                                    'type': game.type === 1 ? "1" : "0",
                                                    'region': region.id
                                                };
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            })['catch'](function (reason) {
                console.log('Error:', reason);
            });
        }
    }


    /**
     * @ngdoc method
     * @name subToCashOut
     * @methodOf vbet5.controller:myBetsCtrl
     * @description subscribe to cash out notifications
     **/
    function subToCashOut() {
        if (cashOutSubId || $rootScope.env.sliderContent !== 'recentBets' && $rootScope.env.sliderContent !== 'betHistory') {
            return;
        }
        var bets = Config.main.enableMixedView ? betHistory : allBets;
        cashOutSubId = BetService.cashOut.subscribe(function updateCashOutAmount(data) {
            bets.forEach(function(bet) {
                if (data[bet.id]) {
                    bet.cash_out = data[bet.id].amount;
                }
            });
            $rootScope.$broadcast('updatePopUpInfo');
        });
    }


    /**
     * @ngdoc method
     * @name updateMyBets
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Update my bets section
     * @param {Object} bets data
     */
    function updateMyBets(data) {
        if (data && data.bets) {
            allBets = Utils.objectToArray(data.bets);
            fillBetsPointerInfo(allBets);
            convertStringFiledsToNumbers(allBets);
            fixBetItemNames(allBets);

            if (Config.env.sliderContent === 'recentBetsCashout') {
                allBets = filterCashoutBet(allBets);
            }

            $scope.allBetsCount = allBets.length;
            console.log(allBets, allBets.length);
            $scope.myBets = getVisibleBets(allBets);
        }
    }

    /**
     * @ngdoc method
     * @name slide
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Slides visible bets left or right by changing $scope's **offset** variable
     *
     * @param {String} direction direction, 'left' or 'right'
     */
    $scope.slide = function slide(direction) {
        if (direction === 'left') {
            if ($scope.offset > 0) {
                $scope.offset--;
            }
        } else if (direction === 'right') {
            if ($scope.offset < allBets.length - $scope.BETS_TO_SHOW) {
                $scope.offset++;
            }
        }
        $scope.myBets = getVisibleBets(allBets);
    };

    /**
     * @ngdoc method
     * @name loadMyBets
     * @methodOf vbet5.controller:myBetsCtrl
     * @description loads
     */
    $scope.loadMyBets = function loadMyBets() {
        $scope.myBetsLoaded = false;
        $scope.offset = 0;
        function doLoadMyBets() {
            var request = {
                'where': {
//             'from_date': int(time.time()) - 24*3600,
//             'to_date': int(time.time()),
//             'outcome': 3,
//             'bet_type': 1,
//             'with_pool_bets': true
                }
            };
            if ($rootScope.calculatedConfigs.poolBettingEnabled) {
                request.where.with_pool_bets = true;
            }

            if (Config.env.sliderContent === 'recentBetsCashout' || Config.main.betHistoryForMonth) {
                var time = Moment.get().subtract('months', 0).startOf('month');
                request.where.from_date = time.unix();
                request.where.to_date = time.clone().add('months', 1).unix();
            }

            Zergling.get(request, 'bet_history')
                .then(
                    function (response) {
                        updateMyBets(response);
                        subToCashOut();
                        $scope.myBetsLoaded = true;
                    },
                    function (failResponse) {
                        console.log('failed loading my bets', failResponse);
                        $scope.errorLoadingBets = true;
                    }
                );
        }

        if (Config.env.authorized) {
            doLoadMyBets();
        } else {
            $rootScope.loginRestored.then(doLoadMyBets);
        }
    };

    /**
     * @ngdoc method
     * @name gotoBetGame
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  Navigates to Events game
     *
     * @param {Object} betEvent bet history Event
     */
    $scope.gotoBetGame = function gotoBetGame(betEvent) {
        if ($rootScope.gamePointers[betEvent.game_id]) {
            $rootScope.$broadcast('gotoSelectedGame', $rootScope.gamePointers[betEvent.game_id]);
        }
    };

    function calculateTaxAndBonus(bets) {
        for (var i = bets.length; i--;) {
            var score = (bets[i].outcome === 0 && bets[i].possible_win) || (bets[i].outcome !== 0 && bets[i].payout);
            if (score) {
                bets[i].tax = bets[i].winningBonus = score * $rootScope.partnerConfig.tax_percent / 100 ;
            }
        }
    }

    /**
     * @ngdoc method
     * @name initBetHistory
     * @methodOf vbet5.controller:myBetsCtrl
     * @description init function. Generates  month and weeks data for select box and loads bets for the first month
     */
    $scope.initBetHistory = function initBetHistory(product) {
        function doInitBetHistory() {
            var i, iMax = 6, time, monthFormat = 'MMMM YYYY', weekFormat = 'DD MMM';
            if (Config.env.lang === 'jpn') {
                monthFormat = 'YYYY年 MMMM';
                weekFormat = 'DD日 MMM';
            }

            if ($rootScope.profile && $rootScope.profile.reg_date) {
                var format = ($rootScope.profile.reg_date.indexOf('.') > -1) ? 'DD.MM.YYYY' : '';
                var regPeriod = Moment.get().diff(Moment.get($rootScope.profile.reg_date, format).startOf('month'), 'days') / 30;
                iMax = (regPeriod && (regPeriod > 0) && (regPeriod < iMax)) ? (regPeriod < 1 ? 1 : regPeriod) : iMax;
            }
            for (i = 0; i < iMax; i++) {
                time = Moment.get().subtract('months', i).startOf('month');
                $scope.betHistoryParams.dateRanges.push({
                    fromDate: time.unix(),
                    toDate: time.clone().add('months', 1).unix(),
                    str: time.format(monthFormat),
                    type: 'month'
                });

                $scope.monthIndexes.push($scope.betHistoryParams.dateRanges.length - 1);

                var monthDays = i === 0 ? Moment.get().lang('en').format('D') : time.clone().endOf('month').lang('en').format('D'),
                    wCount = parseInt(monthDays / 7, 10),
                    moreDaysCount = monthDays % 7;
                var j, fromDate, toDate, weekDates = [];
                for (j = 0; j < wCount; j++) {
                    fromDate = time.clone().add('days', j * 7);
                    toDate = time.clone().add('days', (j + 1) * 7);
                    weekDates.push({
                        fromDate: fromDate.unix(),
                        toDate: toDate.unix(),
                        str: "· " + (fromDate.format(weekFormat) + " - " + toDate.format(weekFormat)),
                        type: 'week'
                    });
                }
                if (moreDaysCount > 0) {
                    fromDate = time.clone().add('days', j * 7);
                    toDate = fromDate.clone().add('days', moreDaysCount);
                    var str = moreDaysCount == 1 ? fromDate.format(weekFormat) : fromDate.format(weekFormat) + " - " + toDate.format(weekFormat);
                    weekDates.push({fromDate: fromDate.unix(), toDate: toDate.unix(), str: "· " + str, type: 'week'});
                }
                $scope.betHistoryParams.dateRanges = $scope.betHistoryParams.dateRanges.concat(weekDates.reverse());
            }
            $scope.dataSelectedIndex = product === 'Casino' ? "1" : "0";
            $scope.loadBetHistory(product);
        }

        if (Config.env.authorized) {
            doInitBetHistory();
        } else {
            $rootScope.loginRestored.then(doInitBetHistory);
        }
    };

    function getAgentBetHistory(request) {
        Zergling.get(request, 'get_bet_history_totals').
        then(function (response) {
            if (response && response.details) {
                $scope.agentBetHistory = response.details;
            }
        })['finally'](function () {
            $scope.betHistoryLoaded = true;
        });
    }

    /**
     * @ngdoc method
     * @name loadBetHistory
     * @methodOf vbet5.controller:myBetsCtrl
     * @description loads bet history according to selected parameters from  **$scope.betHistoryParams**
     * and selects first page
     */
    $scope.loadBetHistory = function loadBetHistory(product,  callbackFunction) {
        $scope.betHistoryLoaded = false;

        var where = {};

        if ($scope.betHistoryParams.dateRanges.length > 0) {
            $scope.betHistoryParams.dateRange = $scope.betHistoryParams.dateRanges[$scope.dataSelectedIndex];
        }
        if ($scope.betHistoryParams.dateRange && $scope.betHistoryParams.dateRange.fromDate !== -1) {
            if ($scope.selectedUpcomingPeriod) {
                where.from_date = Moment.get().unix() - $scope.selectedUpcomingPeriod * 3600;
                where.to_date = Moment.get().unix();
            } else {
                where.from_date = $scope.betHistoryParams.dateRange.fromDate;
                where.to_date = $scope.betHistoryParams.dateRange.toDate;
            }
        }

        if ($scope.betStatusFilter === 10) { // it mean selected tab is Agent info
            getAgentBetHistory(where);
            return;
        }

        var isVivaroShuka = (product === 'shukaBetHistory'),
            betType = parseInt($scope.betHistoryParams.betType, 10),
            type = parseInt($scope.betHistoryParams.type, 10),
            outcome = parseInt($scope.betHistoryParams.outcome, 10);

        if ($scope.betHistoryParams.betIdFilter && !isNaN(parseInt($scope.betHistoryParams.betIdFilter))) {
            where.bet_id = parseInt($scope.betHistoryParams.betIdFilter);
        }

        if (outcome !== -1) {
            where.outcome = outcome;
        }
        if (betType !== -1) {
            where.bet_type = betType;
        }
        if (type !== -1) {
            where.type = type.toString();
        }
        if ($rootScope.calculatedConfigs.poolBettingEnabled && !isVivaroShuka && !$scope.betHistoryParams.betIdFilter) {
            where.with_pool_bets = true;
        }
        var request = {'where': where};
        var command = 'bet_history';
        if (isVivaroShuka) {
            command = 'fair_bets_history';
            request = where;
        }
        if (product && !isVivaroShuka) {
            request.product = product;
        }

        $scope.errorLoadingHistory = false;
        $scope.profit.show = false;
        Zergling.get(request, command)
            .then(
                function (response) {
                    if (response.result === -1 || !response.bets) {
                        $scope.errorLoadingHistory = true;
                        return;
                    }

                    if (!(response.bets instanceof  Array)) {
                        var tempData = response.bets;
                        response.bets = [];
                        response.bets[0] = tempData;
                    }
                    fixBetItemNames(response.bets);
                    calculateLiability(response.bets);
                    calculateSystemCombinations(response.bets);
                    betHistory = response.bets;
                    fillBetsPointerInfo(betHistory);
                    convertStringFiledsToNumbers(response.bets);
                    allBets = Utils.objectToArray(response.bets);
                    var sortParam = response.bets[0] && response.bets[0]['bet_date'] !== undefined ? 'bet_date' : 'date_time';
                    response.bets = Utils.twoParamsSorting(response.bets, [sortParam]);
                    response.bets.reverse();
                    subToCashOut();
                    if (!Config.main.enableMixedView) {
                        $scope.betHistoryGotoPage(1);
                    } else {
                        $scope.betHistory = betHistory;
                        $scope.childBets = groupPartiallyCashedOut(betHistory);
                    }

                    if ($scope.profit.checkAfterLoad) {
                        $scope.calculateProfit();
                    }
                    if ($rootScope.partnerConfig && $rootScope.partnerConfig.tax_percent && $rootScope.partnerConfig.tax_type === 20) {
                        calculateTaxAndBonus($scope.betHistory);
                    }
                    $scope.betHistoryLoaded = true;
                    console.log('bet history:', betHistory, where);
                    if(callbackFunction){
                        callbackFunction();
                    }
                },
                function (failResponse) {
                    console.log('failed loading bets history', failResponse);
                    $scope.errorLoadingHistory = true;
                }
            );
    };

    /**
     * @ngdoc method
     * @name betHistoryGotoPage
     * @methodOf vbet5.controller:myBetsCtrl
     * @description selects slice of bet history data according to given page number
     *
     * @param {Number} page page number
     */
    $scope.betHistoryGotoPage = function betHistoryGotoPage(page) {
        $scope.totalPages = parseInt(betHistory.length / BETS_PER_HISTORY_PAGE + (betHistory.length % BETS_PER_HISTORY_PAGE ? 1 : 0), 10);
        $scope.betHistoryPages = Utils.createPaginationArray($scope.totalPages, page, 10);
        $scope.betHistoryActivePage = page;
        var start = (page - 1) * BETS_PER_HISTORY_PAGE;
        var end = page * BETS_PER_HISTORY_PAGE;
        end = end > betHistory.length ? betHistory.length : end;
        $scope.betHistory = betHistory.slice(start, end);
    };

    $scope.openPrintPreview = BetService.print.openPrintPreview;

    /**
     * @ngdoc method
     * @name poolBettingSelection
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Translates backend selection to readable format 1 = W1, 2 = X, 3 = W2
     *
     * @param {string} data backend selection data
     */
    $scope.poolBettingSelection = function poolBettingSelection(data) {
        if (!data) {
            return '';
        }

        var r, length = data.length;
        var out = [];

        for (r = 0; r < length; r++) {
            if (data[r] && $scope.poolBettingMap[data[r]]) {
                out.push($scope.poolBettingMap[data[r]]);
            }
        }

        return out.join(', ');
    };

    if (Config.main.betHistoryCashoutEnabled && (Config.env.sliderContent === 'recentBetsCashout' || Config.env.sliderContent === 'recentBets')) {
        sliderContentWatcherPromise = $scope.$watch('env.sliderContent', function (newValue, oldValue) {
            if ((newValue === 'recentBets' && oldValue === 'recentBetsCashout') || (newValue === 'recentBetsCashout' && oldValue === 'recentBets')) {
                $scope.loadMyBets();
            }
        });
    }

    // We store this function in the scope, so that we are able to call it from mixedMyBetsCtrl
    $scope.unsubscribeFromCashOut = function unsubscribeFromCashOut() {
        if (cashOutSubId) {
            BetService.cashOut.unsubscribe(cashOutSubId);
            cashOutSubId = null;
        }
    };

    $scope.$on('$destroy', function () {
        $scope.unsubscribeFromCashOut();
        if (sliderContentWatcherPromise) {
            sliderContentWatcherPromise();
        }
    });

    /**
     * @ngdoc method
     * @name calculateProfitPrevMonth
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Month profit calculation for previous month
     */
    $scope.calculateProfitPrevMonth = function calculateProfitPrevMonth() {
        $scope.dataSelectedIndex = $scope.monthIndexes[1].toString();
        $scope.profit.checkAfterLoad = true;
        $scope.loadBetHistory();
    };

    /**
     * @ngdoc method
     * @name calculateProfitPrevMonth
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Month profit calculation for current month
     */
    $scope.calculateProfit = function calculateProfit(isThisMonth) {
        var request = {
            is_current_month: isThisMonth ? 1 : 0
        };

        Zergling.get(request, 'get_client_month_profit').then(function (response) {
            if (response && response.details) {
                $scope.profit.show = true;
                $scope.profit.result = response.details.profit;
                $scope.profit.checkAfterLoad = false;
            }
        });
        $scope.isThisMonth = isThisMonth;
    };

    /**
     * @ngdoc method
     * @name getGameInfo
     * @methodOf vbet5.controller:myBetsCtrl
     * @description Get game info from backend
     * @param {Object} event data
     */
    $scope.getGameInfo = function getGameInfo(event) {
        if (event.game_id && event.scores === undefined) {
            event.scores = Translator.get('Result') +': ';
            if (event.outcome > 0) {
                Zergling.get({match_id_list: [event.game_id]}, 'get_match_scores').then(function (response) {
                    if (response && response.details && response.details.length) {
                        event.scores += response.details[0].score;
                        if (event.home_score !== null && event.away_score !== null) {
                            event.initialScore = Translator.get('Score at the moment of bet')  + ': ' + event.home_score + ':' + event.away_score;
                        }
                    } else {
                        event.scores += Translator.get('Not Available');
                    }
                }, function () {
                    event.scores += Translator.get('Not Available');
                });
            } else {
                event.scores += Translator.get('Not Available');
            }

        }
    };

    function groupPartiallyCashedOut(bets) {
        var childBets = {},
            i = bets.length;

        while (i--) {
            if (bets[i].parent_bet_id) {
                childBets[bets[i].parent_bet_id] = childBets[bets[i].parent_bet_id] || [];
                bets[i].totalAmount = bets[i].bonus_bet_amount ? bets[i].bonus_bet_amount : bets[i].amount || 0;
                childBets[bets[i].parent_bet_id].push(bets[i]);
            }
        }

        return childBets;
    }

    /**
     * @ngdoc method
     * @name updateAfterCashout
     * @methodOf vbet5.controller:myBetsCtrl
     * @description updates cash out information of a specific event after a bet has been 'cashed out'
     */
    function updateAfterCashout(betId, autoCashout) {
        var request = {'where': { 'bet_id': betId }};

        $timeout(function() {
            Zergling.get(request, 'bet_history')
                .then(function(response) {
                    if (response && response.bets) {
                        var currentBets = Config.main.enableMixedView ? betHistory : allBets;
                        var cashedOutBet = response.bets[0];
                        for (var i = 0, length = currentBets.length; i < length; i++) {
                            if (currentBets[i].id === cashedOutBet.id) {
                                cashedOutBet.oddTypeMapped = $scope.ODD_TYPE_MAP[+cashedOutBet.odd_type];
                                currentBets[i] = cashedOutBet;
                                break;
                            }
                        }
                        if (Config.main.enableMixedView) {
                            $scope.betHistory = currentBets;
                        } else {
                            $scope.myBets = getVisibleBets(currentBets);
                        }
                    }
                });
        }, 950);
    }

    $scope.$on('updateAfterCashout', function(event, data) {
       updateAfterCashout(data.betId, data.autoCashout);
    });

    $scope.addEvents = BetService.repeatBet;

    /**
     * @ngdoc function
     * @name filterBetHistory
     * @methodOf vbet5.controller:myBetsCtrl
     * @description  Filters bet history tabs
     * @param {Number} [newStatus]: undefined - all bets, 0 - open, 1 - lost, 2 - returned, 3 - won, 5 - cashed out
     */
    $scope.filterBetHistory = function filterBetHistory(newStatus) {
        if (newStatus !== $scope.betStatusFilter) {
            $scope.betStatusFilter = newStatus;

            if ($scope.betStatusFilter === 10) {
                $scope.loadBetHistory();
            }
        }
    };


    $scope.openCorrespondingGame = function openCorrespondingGame(event) {
        var game = $scope.gamePointers[event.game_id];
        if (game) {
            $location.search({
                'type': game.type === '0' ? 0 : 1,
                'sport': game.sport.id,
                'region': game.region,
                'competition': game.competition,
                'game': game.game
            });

            var neededPath = Utils.getPathAccordintToAlias(game.sport.alias, game.sport.type);
            $location.path(neededPath);

            $scope.env.showSlider = false;
            $scope.env.sliderContent = '';
        }
    };

}]);
