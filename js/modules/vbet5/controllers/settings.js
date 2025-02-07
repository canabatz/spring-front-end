/* global VBET5 */
/**
 * @ngdoc controller
 * @name vbet5.controller:settingsCtrl
 * @description
 * settings controller
 */
VBET5.controller('settingsCtrl', ['$scope', '$rootScope', '$location', '$document', '$q', 'Zergling', 'Translator', 'AuthData', 'Config', 'Utils', 'Moment', 'CountryCodes', function ($scope, $rootScope, $location, $document, $q, Zergling, Translator, AuthData, Config, Utils, Moment, CountryCodes) {
    'use strict';

    var REG_FORM_BIRTH_YEAR_LOWEST = 1900;
    var referralStartDate = Config.main.friendReferral;
    $scope.countryCodes = Utils.objectToArray(Utils.getAvailableCountries(CountryCodes), 'key');

    $scope.countryCodes = $scope.countryCodes.sort(Utils.alphabeticalSorting);
    $scope.registrationData = {};

    $scope.personalDetails = angular.copy(Config.main.personalDetails);
    $scope.patterns = Config.main.personalDetails.patterns;
    checkSettingsDeeplink();
    $scope.changepasswordData = {
        oldpassword: '',
        password: '',
        password2: ''
    };

    $scope.preferences = {
        oddFormat: 'american',
        language: $rootScope.env.lang
    };

    $scope.monthNames = Config.main.monthNames;

    $scope.resetError = {};
    $scope.passwordResetError = {};
    $scope.forms = {}; // used for storing forms, otherwise wouldn't be accessible in controller

    // if field name is not in this object then name of the field in get_user and update_user requests is the same
    var fieldNamesInUpdateUserInfo = {
        sur_name: 'last_name',
        phone_number: 'phone'
    };

    /**
     * @ngdoc method
     * @name changePassword
     * @methodOf vbet5.controller:settingsCtrl
     * @description changes user password using data from corresponding form
     */
    $scope.changePassword = function changePassword() {
        if ($scope.working || $scope.env.sliderContent !== 'settings') return;

        $scope.working = true;
        $scope.forms.changepasswordForm.oldpassword.$invalid = $scope.forms.changepasswordForm.oldpassword.$error.incorrect = false;
        $scope.forms.changepasswordForm.$setPristine();
        var request = {
            password: $scope.changepasswordData.oldpassword,
            new_password: $scope.changepasswordData.password

        };

        if($scope.conf.smsVerification.registration.enabled){
            request.confirmation_code = $scope.changepasswordData.confirmation_code;
        }

        Zergling.get(request, 'update_user_password').then(function (response) {
            if (response.auth_token) {
                var authData = AuthData.get();
                authData.auth_token = response.auth_token;
                AuthData.set(authData);
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'success',
                    title: 'Success',
                    content: 'Password changed'
                });

                if ($scope.forms.changepasswordForm) {
                    // Cleaning up password fields after successful change
                    $scope.changepasswordData.oldpassword = '';
                    $scope.changepasswordData.password = '';
                    $scope.changepasswordData.password2 = '';
                    $scope.changepasswordData.confirmation_code = '';

                    $scope.forms.changepasswordForm.$setPristine();
                    $scope.forms.changepasswordForm.$setUntouched();
                }

            } else if (response.result) {
                var error_message = 'message_' + response.result;
                if ([2474, 2476, 2481, 2483, 2482].indexOf(response.result) !== -1) {
                    error_message = Translator.get(response.result_text);
                    $scope.forms.changepasswordForm.confirmation_code.$setValidity('incorrect', true);
                    $scope.forms.changepasswordForm.confirmation_code.$setValidity('invalid', true);
                }

                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: error_message
                });
            } else {
                throw response;
            }
        })['catch'](function (response) {
            if (response.data.match("1006") || response.data.match("1005")) {
                $scope.forms.changepasswordForm.oldpassword.$invalid = $scope.forms.changepasswordForm.oldpassword.$error.incorrect = true;
                return;
            }

            var message = response.code === 12 ? 'Incorrect Current Password' : (Translator.get('Error occured') + ' : ' +response.msg);
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: message
            });
        })['finally'](function() {
            $scope.working = false;
        });
    };

    /**
     * @ngdoc method
     * @name changeDetails
     * @methodOf vbet5.controller:settingsCtrl
     * @description changes user details using data from corresponding form
     */
    $scope.changeDetails = function changeDetails() {
        // Prevent user from updating profile till the previous changes have been resolved
        if (!$scope.working && $scope.env.sliderContent === 'settings') {
            $scope.working = true;
            $document[0].activeElement.blur(); // Need to 'unfocus' password field in order for it not to be $touched after update
            $scope.details.country_code = $scope.details.selectCountryCode && $scope.details.selectCountryCode.key;
            var request = {user_info:{}};
            if ($scope.personalDetails.editableFields.length) {
                var index, i;
                for(i = 0; i < $scope.personalDetails.editableFields.length; i++) {
                    index = $scope.personalDetails.editableFields[i];
                    if(index === 'birth_date' && $scope.birthDate && $scope.birthDate.year && $scope.birthDate.month && $scope.birthDate.day) {
                        $scope.details[index] = $scope.birthDate.year.toString() + '-' + $scope.birthDate.month.toString() + '-' + $scope.birthDate.day.toString();
                    }
                    request.user_info[fieldNamesInUpdateUserInfo[index] || index] = $scope.details[index];
                }
            }
            request.user_info.password = $scope.details.password;
            request.user_info.last_name = request.user_info.last_name || request.user_info.sur_name;

            if (Config.main.gdpr.profile) {
                angular.forEach(Config.main.gdpr.options, function (value, key) {
                    request.user_info[key] = $scope.registrationData[key] === 'true';
                });
            }

            console.log("changeDetails", $scope.personalDetails.editableFields, request, $scope.details);
            Zergling.get(request, 'update_user').then(function (response) {
                if (response.result === 0) {
                    $rootScope.$broadcast("globalDialogs.addDialog", {
                        type: 'success',
                        title: 'Success',
                        content: 'Personal information updated.',
                        buttons: [
                            {title: 'Ok', callback: function() {
                                    /*$rootScope.$broadcast('toggleSliderTab', 'deposit');*/
                                }}
                        ]
                    });

                    $scope.env.showSlider = false;
                    $scope.env.sliderContent = '';

                } else if (response.result === '-1002' || response.result === '-1003' || response.result === '-1005') {
                    $rootScope.$broadcast("globalDialogs.addDialog", {
                        type: 'error',
                        title: 'Error',
                        content: 'Wrong Password' // No need to translate since its translated on the dialog side already
                    });
                } else if (response.result === '-1119') {
                    $scope.forms.detailsForm.email.$invalid = $scope.forms.detailsForm.email.$error.dublicate = true;
                } else if (response.result === '-1123') {
                    $rootScope.$broadcast("globalDialogs.addDialog", {
                        type: 'error',
                        title: 'Error',
                        content: 'Passport Number is already registered for another account' // No need to translate since its translated on the dialog side already
                    });
                } else if (response.result === '-2480') {
                    $rootScope.$broadcast("globalDialogs.addDialog", {
                        type: 'error',
                        title: 'Error',
                        content: 'Invalid Bank Name' // No need to translate since its translated on the dialog side already
                    });
                } else  {
                    $rootScope.$broadcast("globalDialogs.addDialog", {
                        type: 'error',
                        title: 'Error',
                        content: response.result_text
                    });
                }
                console.log(response);
            })['catch'](function (response) {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: Translator.get('Error occured') + ' : ' + response.data
                });
                console.log(response);
            })['finally'](function() {
                $scope.working = false;
            });
        }
    };


    /**
     * @ngdoc method
     * @name loadUserInfo
     * @methodOf vbet5.controller:settingsCtrl
     * @description loads user information from swarm
     */
    $scope.loadUserInfo = function loadUserInfo() {
        $scope.loadingInfo = true;
        Zergling.get({}, 'get_user').then(function (data) {
            $scope.details = data;
            $scope.details.phone_number = $scope.details.phone; // field name is different when loading/saving  :/
            $scope.details.sur_name = $scope.details.last_name || $scope.details.sur_name; // field name is different when loading/saving  :/
            $scope.details.selectCountryCode = CountryCodes[$scope.details.country_code];
            if ($scope.details.selectCountryCode !== undefined && $scope.countryCodes.indexOf($scope.details.selectCountryCode) === -1) {
                $scope.countryCodes.push($scope.details.selectCountryCode);
                $scope.countryCodes = $scope.countryCodes.sort(Utils.alphabeticalSorting);
                var countryCodeIndex = $scope.personalDetails.disabledFields.indexOf('country_code');
                if (countryCodeIndex > -1) {
                    $scope.personalDetails.disabledFields.splice(countryCodeIndex, 1);
                }
                var readOnlyIndex = $scope.personalDetails.readOnlyFields.indexOf('country_code');
                if(readOnlyIndex > -1){
                    $scope.personalDetails.editableFields.push($scope.personalDetails.readOnlyFields.splice(readOnlyIndex, 1)[0]);
                }
            }
            var birthDateIndex = $scope.personalDetails.readOnlyFields.indexOf('birth_date');
            if(!$scope.details.birth_date && birthDateIndex > -1){
                $scope.personalDetails.editableFields.push($scope.personalDetails.readOnlyFields.splice(birthDateIndex, 1)[0]);
                $scope.personalDetails.requiredEditableFields.push("birth_date");
            }
            if (Config.main.getBankInfoToProfile) {
                Zergling.get({}, 'get_bank_info').then(function (response) {
                    if (response && response.details) {
                        $scope.details.bank_info = response.details.bank_info;
                        if ($scope.details.bank_info) {
                            var index = $scope.personalDetails.editableFields.indexOf('bank_info');
                            if (index > -1) {
                                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
                            }
                        }
                    }
                });
            }

            if (Config.main.gdpr.profile) {
                angular.forEach(Config.main.gdpr.options, function (value, key) {
                    if ($scope.details[key] !== undefined) {
                        $scope.registrationData[key] = $scope.details[key] ? 'true' : 'false';
                    }
                });
            }

            prepareOnceEditableFields(); // must be refactored '5163'

            $scope.loadingInfo = false;
        });
    };

    /**
     * @ngdoc method
     * @name prepareOnceEditableFields
     * @methodOf vbet5.controller:settingsCtrl
     * @description Prepare the fields which should be editable only once
     */
    function prepareOnceEditableFields () {
        var index;

        if (!$scope.details.gender) {
            $scope.details.gender = 'M';
        } else {
            index = $scope.personalDetails.editableFields.indexOf('gender');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }
        $scope.details.viewGender = Translator.get({'M': 'Male', 'F': 'Female'}[$scope.details.gender]);

        if ($scope.details.first_name) {
            index = $scope.personalDetails.editableFields.indexOf('first_name');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.middle_name) {
            index = $scope.personalDetails.editableFields.indexOf('middle_name');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.sur_name || $scope.details.last_name) {
            index = $scope.personalDetails.editableFields.indexOf('sur_name');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.email) {
            index = $scope.personalDetails.editableFields.indexOf('email');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.doc_number) {
            index = $scope.personalDetails.editableFields.indexOf('doc_number');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.zip_code) {
            index = $scope.personalDetails.editableFields.indexOf('zip_code');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if($scope.details.birth_date) {  // can edit if birthdate is empty and functionality of edit  enabled from config
            var birthOptions = $scope.details.birth_date.split('-');
            $scope.birthDate = $scope.birthDate || {};
            $scope.birthDate.month = birthOptions[1];
            $scope.birthDate.day = birthOptions[2];
            $scope.birthDate.year = birthOptions[0];

            index = $scope.personalDetails.editableFields.indexOf('birth_date');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
                index = $scope.personalDetails.requiredEditableFields.indexOf('birth_date');
                index > -1 && $scope.personalDetails.requiredEditableFields.splice(index, 1);
            }
        } else if($scope.personalDetails.editableFields.indexOf('birth_date') !== -1) {
            $scope.birthDate = $scope.birthDate || {};
            $scope.birthDate.years = [];
            var i, max = new Date().getFullYear() - Config.main.registration.minimumAllowedAge;
            for (i = max; i >= REG_FORM_BIRTH_YEAR_LOWEST; i -= 1) {
                $scope.birthDate.years[i] = i.toString();
            }
        }

        if ($scope.details.bank_info) {
            index = $scope.personalDetails.editableFields.indexOf('bank_info');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }

        if ($scope.details.account_holder) {
            index = $scope.personalDetails.editableFields.indexOf('account_holder');
            if (index > -1) {
                $scope.personalDetails.readOnlyFields.push($scope.personalDetails.editableFields.splice(index, 1)[0]);
            }
        }
    }


    $scope.depositLimitsData = {
        amount: '',
        day: '',
        week: '',
        month: ''
    };

    $scope.selfExclusionData = {period: 0};

    /**
     * @ngdoc method
     * @name getLimits
     * @methodOf vbet5.controller:settingsCtrl
     * @description loads deposit limits into $scope.depositLimitsData
     */
    $scope.getLimits = function getLimits() {
        Zergling.get({type : 'deposit'}, 'user_limits').then(function (response) {
            $scope.working = false;
            if (response.result === 0) {
                console.log(response.details);
                $scope.depositLimitsData = response.details;
            }

        })['catch'](function (response) {
            $scope.working = false;
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get('Error occured') + ' : ' + response.data
            });
            console.log(response);
        });
    };

    /**
     * @ngdoc method
     * @name setDepositLimits
     * @methodOf vbet5.controller:settingsCtrl
     * @description sets deposit limits
     */
    $scope.setDepositLimits = function setDepositLimits() {
        $scope.working = true;
        var request = {
            type: 'deposit'
        };

        request.limits = [
            {
                deposit_limit: parseFloat($scope.depositLimitsData.max_day_deposit),
                period_type: 2,
                period: 1
            },
            {
                deposit_limit: parseFloat($scope.depositLimitsData.max_week_deposit),
                period_type: 3,
                period: 1
            },
            {
                deposit_limit: parseFloat($scope.depositLimitsData.max_month_deposit),
                period_type: 4,
                period: 1
            }];

        Zergling.get(request, 'set_user_limits').then(function (response) {
            $scope.working = false;
            if (response.result === 0 || response.result === 'OK') {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'success',
                    title: 'Success',
                    content: Translator.get('Deposit limits set.')
                });
            } else {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: Translator.get('Please try later or contact support.')
                });
            }
            console.log(response);
        })['catch'](function (response) {
            $scope.working = false;
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get('Error occured') + ' : ' + response.data
            });
            console.log(response);
        });
        console.log(request);
    };

    /**
     * @ngdoc method
     * @name getBetLimits
     * @methodOf vbet5.controller:settingsCtrl
     * @description loads bet limits into $scope.betLimitsData
     */
    $scope.getBetLimits = function getBetLimits() {
        $scope.loadBetLimits = true;
        var callPromises = [];//TODO remove when back-end change to one call.
        if (!Config.main.betLimits.hideCasinoLimits) {
            callPromises.push(Zergling.get({}, 'get_client_bet_limit'));
        }
        if (!Config.main.betLimits.hideSportsbookLimits) {
            callPromises.push(Zergling.get({}, 'get_client_sport_bet_limit'));
        }
        $q.all(callPromises).then(function (responses) {
            var allIsOk = true;
            for(var i = responses.length; i--;) {
                if(responses[i].result !== 0 || !responses[i].details) {
                    allIsOk = false;
                    break;
                }
            }
            if (allIsOk) {
                if (responses.length > 1) {
                    $scope.betLimitsData = Utils.MergeRecursive(Utils.copyObj(responses[0].details), responses[1].details);
                } else {
                    $scope.betLimitsData = responses[0].details;
                }
            }

        })['catch'](function (response) {
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get('Error occured') + ' : ' + response.data
            });
        })['finally'](function () {
            $scope.loadBetLimits = false;
        });
    };

    function getNumberValues(obj) {
        var result = {};
        for(var key in obj) {
            if (obj.hasOwnProperty(key) && !isNaN(obj[key])) {
                result[key] = obj[key];
            }
        }
        return result;
    }

    /**
     * @ngdoc method
     * @name setBetLimits
     * @methodOf vbet5.controller:settingsCtrl
     * @description sets bet limits
     */

    $scope.setBetLimits = function setBetLimits() {
        if ($scope.working) return;

        var request = {
            casino_max_daily_bet: parseFloat($scope.betLimitsData.CasinoMaxDailyBet),
            casino_max_single_bet: parseFloat($scope.betLimitsData.CasinoMaxSingleBet)
        };
        var sportsbookRequest = {
            "sport_max_daily_bet": parseFloat($scope.betLimitsData.SportMaxDailyBet),
            "sport_max_weekly_bet": parseFloat($scope.betLimitsData.SportMaxWeeklyBet),
            "sport_max_monthly_bet": parseFloat($scope.betLimitsData.SportMaxMonthlyBet),
            "sport_max_single_bet":  parseFloat($scope.betLimitsData.SportMaxSingleBet)
        };
        request = getNumberValues(request);
        sportsbookRequest = getNumberValues(sportsbookRequest);

        var callPromises = []; //TODO remove when back-end change to one call.
        if (!Config.main.betLimits.hideCasinoLimits && Object.keys(request).length > 0) {
            callPromises.push(Zergling.get(request, 'set_client_bet_limit'));
        }
        if (!Config.main.betLimits.hideSportsbookLimits && Object.keys(sportsbookRequest).length > 0) {
            callPromises.push(Zergling.get(sportsbookRequest, 'set_client_sport_bet_limit'));
        }
        if (callPromises.length === 0) {
            return;
        }
        $scope.working = true;

        $q.all(callPromises).then(function (responses) {
            var responseOkCount = 0;
            for(var i = responses.length;i--;) {
                if(responses[i].result === 0 || responses[i].result === 'OK') {
                    responseOkCount += 1;
                }
            }
            if (responseOkCount === callPromises.length) {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'success',
                    title: 'Success',
                    content: Translator.get('Bet limits set.')
                });
                $scope.forms.betLimitsForm.$setPristine();
                $scope.forms.betLimitsForm.$setUntouched();
            } else {
                var message;
                if (responses.length > 1 && responseOkCount === 1) {
                    message = responses[0].result !== 0 && responses[0].result !== 'OK'? "Can't set Casino bet limits": "Can't set Sportsbook bet limits";
                } else {
                    message = 'Please try later or contact support.';
                }
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: Translator.get(message)
                });
                $scope.getBetLimits(); // If new values are not set we make a call to get the old ones
            }
        })['catch'](function (response) {
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get('Error occured') + ' : ' + response.data
            });
            $scope.getBetLimits(); // If new values are not set we make a call to get the old ones
        })['finally'](function () {
            $scope.working = false;
        });
    };

    /**
     * @ngdoc method
     * @name setRealityCheckInterval
     * @methodOf vbet5.controller:settingsCtrl
     * @description Set reality check interval and shows corresponding dialog
     * @param {Number} value the input value
     */
    $scope.setRealityCheckInterval = function setRealityCheckInterval (value) {
        var parsedValue = parseInt(value);
        var request = {active_time: parseInt(parsedValue)};
        $scope.working = true;
        Zergling.get(request, 'update_user_active_time').then(function (response) {
            $scope.working = false;
            if (response.result === 0) {
                $rootScope.profile.active_time_in_casino = parsedValue;
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'success',
                    title: 'Success',
                    content: 'Your Reality Check settings have been updated.'
                });

            } else {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: 'Error'
                });
            }
        })['catch'](function (response) {
            $scope.working = false;
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get('Error occured') + ' : ' + response.data
            });
        });
    };

    $scope.selectPeriod = function selectPeriod(value) {
        $scope.selfExclusionData = value;
    };
    $scope.selectPeriod(Utils.cloneDeep(Config.main.selfExclusion.options[0].limit));

    /**
     * @ngdoc method
     * @name setSelfExclusion
     * @methodOf vbet5.controller:settingsCtrl
     * @description sets self-exclusion periods
     */
    $scope.setSelfExclusion = function setSelfExclusion (type, configName, passwordCtrl) {
        if (configName && Config.main[configName].enabled && Config.main[configName].type === type && Config.main[configName].confirmationText) {
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'info',
                title: 'Confirmation',
                content: Config.main[configName].confirmationText,
                buttons: [{
                    title: 'Yes',
                    callback: function () {
                        setSelfExclusionConfirmed(type, passwordCtrl);
                    }
                }, {
                    title: 'No'
                }]
            });
        } else {
            setSelfExclusionConfirmed(type, passwordCtrl);
        }
    };

    /**
     * @ngdoc method
     * @name setSelfExclusion
     * @methodOf vbet5.controller:settingsCtrl
     * @description sets self-exclusion periods
     */
    function setSelfExclusionConfirmed (type, passwordCtrl) {
        $scope.working = true;
        var request = {
            exc_type: type
        };
        if (passwordCtrl) {
            request.password = $scope.selfExclusionPasswordState.value;
        }

        if($scope.selfExclusionData.type === 'custom') {
            request.days = Moment.moment($scope.customTimeout.date).diff($scope.today, 'days') + 1;
        } else {
            request[$scope.selfExclusionData.type] = $scope.selfExclusionData.period;
        }
        Zergling.get(request, "set_client_self_exclusion").then(function (response) {
            $scope.working = false;
            if (passwordCtrl) {
                $scope.selfExclusionPasswordState.value = "";
                passwordCtrl.$setPristine(true);
                passwordCtrl.$setTouched(false);
            }

            var exTipe = "Time-Out";
            if (response.result === 0 || response.result === 'OK') {
                if (type === Config.main.selfExclusion.type) {
                    $rootScope.$broadcast("self_exclusion_success");
                    $scope.logOut();
                    console.log('Logout After Exclusion');
                    exTipe = "Self-Exclusion";
                }
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'success',
                    title: 'Success',
                    content: Translator.get( exTipe + ' period set.')
                });
            } else {
                $rootScope.$broadcast("globalDialogs.addDialog", {
                    type: 'error',
                    title: 'Error',
                    content: Translator.get(response.result_text || 'Error occured')
                });
            }
            console.log(response);
        })['catch'](function (response) {
            $scope.working = false;
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get(response.result_text || 'Error occured') + ' : ' + response.data
            });
            console.log(response);
        });
        console.log(request);
    }

    /**
     * @ngdoc method
     * @name initFriendReferral
     * @methodOf vbet5.controller:settingsCtrl
     * @description initialize
     */
    $scope.initFriendReferral = function initFriendReferral() {
        $scope.loadingReferralsList = false;
        if (!$scope.refDatesArray) {
            var startDate = Moment.moment([referralStartDate.year, referralStartDate.month - 2]);// (month - 2) because momentjs starts month count from 0 and because we need to include current month
            var monthsPeriod =  Moment.get().diff(startDate, 'months');

            $scope.refDatesArray = [];
            for (var i = 1; i < monthsPeriod; i++) {
                var item = Moment.get().subtract('months', i).startOf('month');
                var date = {
                    text: item.format(('MMMM YYYY')),
                    month: item.month() + 1,
                    year: item.year(),
                    id: i
                };
                $scope.refDatesArray.push(date);
            }
            $scope.selectedFriendRefData = {
                date: $scope.refDatesArray[0]
            };
        }

        $scope.loadFriendReferralData();
    };


    /**
     * @ngdoc method
     * @name loadFriendReferralData
     * @methodOf vbet5.controller:settingsCtrl
     * @description load data for friend referral
     */
    $scope.loadFriendReferralData = function loadFriendReferralData() {
        $scope.loadingReferralsList = true;
        var request = {
            month: $scope.selectedFriendRefData.date.month,
            year: $scope.selectedFriendRefData.date.year
        };
        Zergling.get(request, 'get_ref_client_info').then(function(response) {
            if(response && response.details) {
                console.log("Friend Referral Data:", response);
                $scope.friendReferralData = response.details;
                if(response.details.sub_clients) {
                    if(angular.isArray(response.details.sub_clients.sub_client)) {
                        $scope.friendReferralList =  response.details.sub_clients.sub_client;
                    } else {
                        $scope.friendReferralList = [response.details.sub_clients.sub_client] || "";
                    }
                }
                $scope.loadingReferralsList = false;
            }
        })['catch'](function(error) {
            console.log(error);
        });
    };

    /**
     * @ngdoc method
     * @name calculateAge
     * @methodOf vbet5.controller:settingsCtrl
     * @description Recalculate user age and set to userAge
     */
    $scope.calculateAge = function calculateAge() {
        if ($scope.birthDate && $scope.birthDate.year && $scope.birthDate.month && $scope.birthDate.day)
        {
            var birthDate = new Date($scope.birthDate.year, $scope.birthDate.month - 1, $scope.birthDate.day);
            var today = new Date();
            var age = today.getFullYear() - birthDate.getFullYear();
            var mounts = today.getMonth() - birthDate.getMonth();
            if (mounts < 0 || (mounts === 0 && today.getDate() < birthDate.getDate())){
                age--;
            }
            $scope.userAge = age;
        } else {
            $scope.userAge = null;
        }

    };

    /**
     * @ngdoc method
     * @name resetFieldError
     * @methodOf vbet5.controller:settingsCtrl
     * @description Resets field error
     * @param {String} fieldName name
     * @param {String} type of field (changePassword or depositLimits)
     */
    $scope.resetFieldError = function resetFieldError(fieldName, type) {
        switch (type) {
            case 'changePassword':
                $scope.changepasswordData[fieldName] = '';
                $scope.passwordResetError[fieldName] = true;
                $scope.forms.changepasswordForm[fieldName].$setUntouched();
                break;
            case 'depositLimits':
                $scope.depositLimitsData[fieldName] = '';
                $scope.forms.depositLimitsForm[fieldName].$setUntouched();
                break;
            case 'betLimits':
                $scope.betLimitsData[fieldName] = '';
                $scope.forms.betLimitsForm[fieldName].$setUntouched();
                break;
            default:
                $scope.details[fieldName] = '';
                $scope.resetError[fieldName] = true;
                $scope.forms.detailsForm[fieldName].$setUntouched();
        }
    };

    /**
     * Check settings deep link if given page is not available not open it
     */
    function checkSettingsDeeplink() {
        var page = $rootScope.env.mixedSettingsPage || $location.search().settingspage;
        var isAllowed = false;
        if (page) {
            switch(page) {
                case 'details':
                    isAllowed = true;
                    break;
                case 'changepassword':
                    isAllowed = !$scope.conf.disableChangePassword;
                    break;
                case 'verifyaccount':
                    isAllowed = $scope.conf.enableAccountVerification || $scope.conf.accountVerificationMessage;
                    break;
                case 'usertimeout':
                    isAllowed = $scope.conf.userTimeOut.enabled;
                    break;
                case 'promoCode':
                    isAllowed = $scope.conf.profilePromoCodeUrl;
                    break;
                case 'selfexclusion':
                    isAllowed = $scope.conf.selfExclusion.enabled;
                    break;
                case 'gamstop':
                    isAllowed = $scope.conf.gamstop && $scope.conf.gamstop.enabled;
                    break;
                case 'realitycheck':
                    isAllowed = $scope.conf.realityCheck.enabled;
                    break;
                case 'loginLimit':
                    isAllowed = $scope.conf.loginLimit.enabled;
                    break;
                case 'depositlimits':
                    isAllowed = $scope.conf.enableDepositLimits;
                    break;
                case 'betlimits':
                    isAllowed = $scope.conf.betLimits && $scope.conf.betLimits.enabled && !($scope.conf.betLimits.hideSportsbookLimits && $scope.conf.betLimits.hideCasinoLimits);
                    break;
                case 'campaign':
                    isAllowed = $scope.conf.enableCampaign;
                    break;
                case 'loginHistory':
                    isAllowed = $scope.conf.enableLoginHistory;
                    break;
                case 'friendReferral':
                    isAllowed = $scope.conf.friendReferral && $scope.conf.friendReferral.enabled;
                    break;
                case '12MonthsProfit':
                    isAllowed = $scope.conf.enable12MonthsProfit;
                case 'twoFactorAuthentication':
                    isAllowed = $scope.conf.enableTwoFactorAuthentication;
                    break;
            }
            $location.search('settingspage', undefined);
            if(!isAllowed) {
                $scope.env.sliderContent = "";
                $scope.env.showSlider = false;
            }else  {
                $scope.env.mixedSettingsPage = page;
            }
        } else {
            $scope.env.mixedSettingsPage = Config.main.settingsDefaultPage; //deep linking
        }
    }

    /**
     * @ngdoc method
     * @name sendVerificationCodeSMS
     * @methodOf vbet5.controller:settingsCtrl
     * @description changes user password using data from corresponding form
     */
    $scope.sendVerificationCodeSMS = function sendVerificationCodeSMS() {
        if ($scope.working || $scope.env.sliderContent !== 'settings') return;

        $scope.working = true;
        var phoneNumber =  $rootScope.profile.phone;

        if(!phoneNumber){
            $rootScope.$broadcast("globalDialogs.addDialog", {
                type: 'error',
                title: 'Error',
                content: Translator.get("Phone number is empty")
            });
            $scope.working = false;
            return;
        }

        if(phoneNumber.indexOf("00") === 0){
            phoneNumber =  phoneNumber.replace(/^00/,'');
        }

        var request = {
            action_type: 3,
            phone_number: phoneNumber
        };
        Zergling.get(request, 'send_sms_to_phone_number')
            ['finally'](function() {
                $scope.working = false;
            });
    };

    /**
     * @ngdoc method
     * @name initUserTimout
     * @methodOf vbet5.controller:settingsCtrl
     * @description checks if userTimeOut options contains item with custom date
     */
    $scope.initUserTimout = function initUserTimout() {
        $scope.initSelfExclusion();
        var results = Config.main.userTimeOut.options.filter(function filterTimeoutOption(option) {
            return option.limit.type === 'custom';
        });
        if (results.length === 1) {
            $scope.today = Moment.moment(new Date());
            $scope.minToDate = Moment.moment(new Date()).add(1, 'days');
            $scope.dateOptions = { showWeeks: 'false' };
            $scope.dateState = {
                openedTo: false
            };
            $scope.customTimeout = {
                date: ''
            };
            $scope.timeoutContainsDatepicker = true;
        }
    };

    /**
     * @ngdoc method
     * @name initSelfExclusion
     * @methodOf vbet5.controller:settingsCtrl
     * @description initialize password state
     */
    $scope.initSelfExclusion = function initSelfExclusion() {
        $scope.selfExclusionPasswordState = {
            value: ""
        };
    };

    /**
     * @ngdoc method
     * @name init12MonthsProfit
     * @methodOf vbet5.controller:settingsCtrl
     * @description init 12 Months profit
     */
    $scope.init12MonthsProfit = function init12MonthsProfit() {
        $scope.twelweMonthsProfitData = {
            period: "1"
        };
        $scope.twelweMonthsProfitData.periods = [];
        for (var i = 1; i < 13; ++i) {
            $scope.twelweMonthsProfitData.periods.push(i.toString());
        }

        $scope.get12MonthsProfit = function get12MonthsProfit() {
            $scope.twelweMonthsProfitData.isLoading = true;
            var request = {
                from_date: Moment.get().subtract('months', +$scope.twelweMonthsProfitData.period).unix(),
                to_date: Moment.get().unix()
            };

            Zergling.get(request, "get_client_sport_activity").then(function (data) {
                if(data.result === 0) {
                    $scope.twelweMonthsProfitData.details = data.details;
                }
            })['finally'](function () {
                $scope.twelweMonthsProfitData.isLoading = false;
            });

        };
        $scope.get12MonthsProfit();
    };
}]);
