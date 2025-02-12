/* global VBET5 */
/**
 * @ngdoc directive
 * @name vbet5.directive:promotionNews
 * @description Renders promotion news by given slug from wordpress
 */
VBET5.directive('promotionNews',
    ['$routeParams', '$window', '$sce', '$location', '$timeout', 'Config', 'WPConfig', 'content', 'Utils', 'analytics', 'DomHelper',
        function ($routeParams, $window, $sce, $location, $timeout, Config, WPConfig, content, Utils, analytics, DomHelper) {
            'use strict';
            var templates = {
                slider: 'templates/directive/promotion-news-slider.html',
                main: 'templates/directive/promotion-news.html'
            };
            return {
                restrict: 'E',
                replace: false,
                template: '<div ng-include="getTemplate()"></div>',
                scope: {
                    count: '@',
                    hideDates: '@',  //hides publish date
                    mainClass: '@',
                    template: '@',
                    path: '@',       //path of page where directive or placed (for generating sharing links)
                    sharePath: '@',   // if specified, this path will be used in sharing link generation (without deeplinking to specific promo)
                    slug: '@',
                    categorySlugKey: '@',
                    useCustomBaseHost: '@', // for new cms
                    categoryJsonType: '@',
                    newsAreLoading: '@',
                    recentNewsList: '@',
                    categoriesList: '@'
                },
                link: function ($scope, element, attrs) {
                    var recentNews = [], newsPerGroup = WPConfig.news.pokerNewsPerGroup, isSliderMode,
                        SLIDER_NEWS_COUNT = {
                            wideOn: 4,
                            wideOff: 3
                        };
                    $scope.promotionsFilter = {};
                    $scope.count = $scope.count || WPConfig.news.numberOfRecentNews;
                    $scope.showDates = !$scope.hideDates;

                    function initSliderMode() {
                        $scope.slideLeft = function () {
                            $scope.selectedGroupId--;
                        };
                        $scope.slideRight = function () {
                            $scope.selectedGroupId++;
                        };
                        $scope.pickFirstGroup = function (group) {
                            $scope.selectedGroupId = group.id;
                        };
                    }

                    $scope.getTemplate = function () {
                        var url;
                        if (templates[attrs.template]) {
                            url = templates[attrs.template];
                                isSliderMode = true;
                                initSliderMode();
                        } else {
                            url = templates.main;
                        }
                        return url;

                    };

                    function promotionIsVisible(news) {
                        return !$scope.promotionsFilter.name || ($scope.promotionsFilter.name==='actual' && news.actual) || ($scope.promotionsFilter.name==='finished' && !news.actual);
                    }

                    function groupNewsInGroups(count) {
                        var groupCount = count || newsPerGroup;
                        if (recentNews) {
                            if ($scope.promotionsFilter && $scope.promotionsFilter.name) {
                                var recentNewsFiltered = [];
                                angular.forEach(recentNews, function (news) {
                                    if (promotionIsVisible(news)) {
                                        recentNewsFiltered.push(news);
                                    }
                                });
                                $scope.recentNewsList = Utils.groupToGroups(recentNewsFiltered, groupCount, 'news');
                            } else {
                                $scope.recentNewsList = Utils.groupToGroups(recentNews, groupCount, 'news');
                            }
                        }
                    }

                    function findAndOpenNews() {
                        var searchParams = $location.search();

                        if (searchParams.news !== undefined) {
                            var newsID = parseInt(searchParams.news, 10);
                            var i, j;
                            for (i = 0; i < $scope.recentNewsList.length; i++) {
                                for (j = 0; j < $scope.recentNewsList[i].news.length; j++) {
                                    if ($scope.recentNewsList[i].news[j].id == newsID) {
                                        $timeout(function () {
                                            $scope.showNews($scope.recentNewsList[i].news[j], $scope.recentNewsList[i].id);
                                        }, 1000);

                                        return;
                                    }
                                }
                            }
                        }
                    }

                    function getPermaLink(news) {
                        var link, origin = $window.location.protocol + "//" + $window.location.hostname + ($window.location.port ? ':' + $window.location.port : '');
                        link = origin + $window.document.location.pathname + $scope.path + '/' + encodeURIComponent(Utils.generatePermaLink(news));
                        return link;
                    }

                    /**
                     * @ngdoc method
                     * @name groupSliderNews
                     * @description  Group news depend on screen for slider mode
                     *
                     */
                    function groupSliderNews() {
                        if (DomHelper.getWindowSize().width < 1300) {
                            groupNewsInGroups(SLIDER_NEWS_COUNT.wideOff);
                        } else {
                            groupNewsInGroups(SLIDER_NEWS_COUNT.wideOn);
                        }
                    }

                    /**
                     * Retrive news from backend
                     * @param count
                     */
                    function loadNews(count) {
                        count = parseInt(count, 10) || count;
                        if ($scope.slug) {
                            $scope.newsAreLoading = true;
                            content.getPostsByCategorySlug($scope.slug, $scope.categoryJsonType, count, false, WPConfig.wpPromoUrl, $scope.useCustomBaseHost && WPConfig.wpPromoCustomBaseHost).then(function (response) {
                                $scope.newsAreLoading = false;
                                if (response.data && response.data.posts) {
                                    recentNews = response.data.posts;
                                    var i, length = recentNews.length;
                                    for (i = 0; i < length; i += 1) {
                                        recentNews[i].titleRaw = angular.element('<div/>').html(recentNews[i].title).text(); //decode html entities
                                        recentNews[i].permalink = getPermaLink(recentNews[i]);
                                        recentNews[i].title = $sce.trustAsHtml(recentNews[i].title);
                                        recentNews[i].content = $sce.trustAsHtml(recentNews[i].content);
                                    }

                                    (templates[attrs.template]) ? groupSliderNews() : groupNewsInGroups();
                                    $scope.areThereMore = $scope.count < response.data.count;
                                    findAndOpenNews();
                                }
                            });
                        }
                    }

                    $scope.setPromotionsFilter = function setPromotionsFilter(name) {
                        $scope.promotionsFilter.name = name;
                        groupNewsInGroups();
                    };


                    /**
                     * @ngdoc method
                     * @name showNews
                     * @methodOf CMS.controller:cmsPagesCtrl
                     * @description  Sets selected news
                     *
                     * @param {object} news news object
                     */
                    $scope.showNews = function showNews(news, groupId) {
                        if ($scope.selectedNews === news) {
                            $scope.closeNews();
                            return;
                        }
                        $location.search('news', news.id);
                        analytics.gaSend('send', 'event', 'news', 'show poker news', {
                            'page': $location.path(),
                            'eventLabel': news.categories.length > 0 ? news.categories[0].title : ''
                        });
                        $scope.selectedNews = news;
                        $scope.selectedNewsGroupId = groupId;
                        if (typeof $scope.selectedNews.content === 'string') { //not to do it twice
                            $scope.selectedNews.content = $sce.trustAsHtml($scope.selectedNews.content);
                        }
                        if (typeof $scope.selectedNews.title === 'string') { //not to do it twice
                            $scope.selectedNews.title = $sce.trustAsHtml($scope.selectedNews.title);
                        }

                        DomHelper.scrollIntoView('news' + $scope.selectedNews.id);

                    };

                    $scope.loadMore = function loadMore() {
                        $scope.count += newsPerGroup === WPConfig.news.newsPerGroupWide ? WPConfig.news.increaseByWide : WPConfig.news.increaseBy;
                        loadNews($scope.count);
                    };

                    $scope.$on('widescreen.on', function () {
                        newsPerGroup = WPConfig.news.pokerNewsPerGroupWide;
                        (templates[attrs.template]) ? groupNewsInGroups(SLIDER_NEWS_COUNT.wideOn) : groupNewsInGroups();
                    });

                    $scope.$on('widescreen.off', function () {
                        newsPerGroup = WPConfig.news.pokerNewsPerGroup;
                        (templates[attrs.template]) ? groupNewsInGroups(SLIDER_NEWS_COUNT.wideOff) : groupNewsInGroups();
                    });

                    /**
                     * @ngdoc method
                     * @name closeNews
                     * @methodOf CMS.controller:cmsPagesCtrl
                     * @description  closes open news
                     */
                    $scope.closeNews = function closeNews() {
                        $scope.selectedNews = null;
                        $location.search('news', undefined);
                    };
                    /**
                     * @ngdoc method
                     * @name setSlug
                     * @description  set current slug from promotions menu
                     *
                     */
                    $scope.setSlug = function setSlug(slug, isInitialize) {
                        if($scope.slug !== slug || isInitialize) {
                            $scope.slug = slug;
                            $location.search("slug", slug);
                            if (!isInitialize) {
                                $scope.closeNews();

                            }
                            loadNews($scope.count);
                        }
                    };

                    /**
                     * @ngdoc method
                     * @name loadCategories
                     * @description  load promotion categories
                     *
                     */
                    function loadCategories() {
                        $scope.promotionCategories = [];
                            content.getPromotionCategories().then(function(data) {
                                var slug = $location.search().slug || $scope.slug;
                                if(data && data.data && data.data.status === "ok" && data.data.categories.length > 0) {
                                    var categories = data.data.categories;
                                    for (var i = 0, length = categories.length; i < length; ++i) {
                                        $scope.promotionCategories.push({
                                            title: categories[i].title,
                                            key: categories[i].name
                                        });
                                    }
                                }
                                if ($scope.promotionCategories.length > 0 && !slug) {
                                    slug = $scope.promotionCategories[0].key;
                                }

                                $scope.setSlug(slug, true);
                        });
                    }

                    // Initialize directive
                    (function init() {
                        if ($scope.categoriesList) {
                            loadCategories();
                        } else {
                            loadNews($scope.count);
                        }
                    }());
                }
            };
        }
    ]);
