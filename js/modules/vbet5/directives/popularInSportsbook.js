/**
 * @ngdoc controller
 * @name vbet5.controller:classicPopularMatchesCtrl
 * @description
 * Popular matches controller
 */
VBET5.directive('popularInSportsbook', ['$rootScope', '$location', 'Config', 'ConnectionService', 'Utils', '$filter', 'analytics', function ($rootScope, $location, Config, ConnectionService, Utils, $filter, analytics) {
    'use strict';
    var connectionService, subId;

    return {
        restrict: 'E',
        templateUrl: 'templates/directive/popular-in-sportsbook.html',
        scope: {
            type: '@',
            title: '@',
            leftMenu: '=?',
            searchField: '@'
        },
        link: function (scope, elem, attrs) {
            connectionService = new ConnectionService(scope);

            scope.popular = {
                icon: attrs.icon || 'favoritecompetitions',
                color: attrs.color || attrs.icon || 'favoritecompetitions',
                expanded: !Config.main.disableSavingPreMatchMenuState
            };

            /**
             * @ngdoc method
             * @name loadPopularMatches
             * @methodOf vbet5.directive:popularMatches
             * @description gets data of popular matches
             */
            function loadPopulars() {
                var request = {
                    'source': 'betting',
                    'what': {
                        'sport': ['id', 'name', 'alias', 'order'],
                        'competition': ['id', 'order', 'name'],
                        'region': ['id', 'name', 'alias', 'order']
                    },
                    'where': {}
                };

                switch (scope.type) {
                    case 'game':
                        request.what.game = ['id', 'team1_name', 'team2_name', 'type', 'order','start_ts', 'favorite_order', 'is_live'];
                        request.where.game = {
                            'type': {'@in': [0, 2]},
                            'promoted': true
                        };
                        break;
                    case 'competition':
                        request.what.competition.push('favorite_order');
                        request.where.competition = { 'favorite': true };
                        break;
                    default:
                        return;
                }
                Utils.setCustomSportAliasesFilter(request);

                connectionService
                    .subscribe(request, updatePopulars, {
                        'thenCallback': function (response) {
                            subId = response.subid;
                        }
                    });
            }

            function updatePopulars(result) {
                scope.popular.data = [];
                if (result.sport) {
                    angular.forEach(result.sport, function (sport) {
                        angular.forEach(sport.region, function (region) {
                            angular.forEach(region.competition, function (competition) {
                                switch (scope.type) {
                                    case 'game':
                                        angular.forEach(competition.game, function (game) {
                                            game.region = region;
                                            game.competition = competition;
                                            game.sport = sport;
                                            scope.popular.data.push(game);
                                        });
                                        break;
                                    case 'competition':
                                        competition.sport = sport;
                                        competition.region = region;
                                        scope.popular.data.push(competition);
                                        break;
                                }
                            });
                        });
                    });
                    if (scope.popular.data && scope.popular.data.length) {
                        var sortKey = scope.popular.data[0].favorite_order === null ? 'order' : 'favorite_order';
                        scope.popular.data.sort(function (a, b) {
                            return a[sortKey] - b[sortKey];
                        });
                    }
                }
            }

            /**
             * @ngdoc method
             * @name toggle
             * @methodOf vbet5.directive:popularMatches
             * @description expand or collapse popular matches
             */
            scope.toggle = function toggle() {
                scope.popular.expanded = !scope.popular.expanded;
                scope.popular.expanded ? loadPopulars() : connectionService.unsubscribe(subId);

                if (scope.leftMenu &&scope.leftMenu.closed) {
                    scope.leftMenu.toggle();
                }
            };

            scope.selectPopular = function selectPopular(type, item) {
                var name = ($rootScope.env.live ? 'Live' : 'Prematch') + ' ' + type + ' ' + item.id + ' ' + item.name;
                analytics.gaSend('send', 'event', 'explorer', 'show popular game markets',  {'page': $location.path(), 'eventLabel': name});
                $rootScope.$broadcast('sportsbook.selectData', {type: 'popular.' + type, data: item});
            };

            scope.getCompetitionTitle = function getCompetitionTitle(popularItem) {
                if(popularItem.team1_name || popularItem.team2_name) {
                    return popularItem.team1_name + ' - ' + popularItem.team2_name;
                } else {
                    return popularItem.region.name;
                }
            };

            //initial
            loadPopulars();
        }
    };
}]);

