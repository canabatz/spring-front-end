/**
 * Created by mariam.kochumyan on 24/01/2018.
 */
/* global VBET5 */
/**
 * @ngdoc filter
 * @name vbet5.filter:capitalise
 * @description capitalises the strings first letter
 *
 */
VBET5.filter('counterOfferRounding', ['Config', function (Config) {
    'use strict';

    return function rounding(num, rounding) {
        var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (rounding || Config.main.roundDecimalCoefficients || -1) + '})?');
        var price = num.toString().match(re)[0];
        var lastElem = price.length - 1;
        if(price % 1 != 0 && price.charAt(lastElem) == 0) {
            return price.substring(0, lastElem);
        }
        return price;
    };
}]);
