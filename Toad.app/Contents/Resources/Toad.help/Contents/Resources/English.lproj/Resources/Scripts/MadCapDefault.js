/// <reference path="../../Scripts/jquery.js" />
/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapFeedback.js" />
/// <reference path="MadCapToc.js" />
/// <reference path="MadCapIndex.js" />
/// <reference path="MadCapHelpSystem.js" />
/// <reference path="MadCapSearch.js" />

/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 *
 * v10.2.2.0
 */

(function () {
    if (MadCap.Dom.Dataset(document.documentElement, "mcRuntimeFileType") != "Default")
        return;
    var tabletBreakpoint;
    var isResponsive = true; // default to false, check on window load
    var $lastActiveTab = null;
    function Window_Onload(e) {
        MadCap.DEBUG.Log.AddLine(window.name + "onload");
        MadCap.DEBUG.Log.AddLine(window.name + "hash: " + document.location.hash);
        MadCap.DEBUG.Log.AddLine(window.name + "search: " + document.location.search);

        // IE9 bug - left/right border radii are reversed in RTL elements
        if ($.browser.msie && $.browser.version <= 9.0) {
            var $searchField = $("#search-field");
            if ($searchField.css("direction") == "rtl") {
                $searchField.css({
                    "border-top-left-radius": $searchField.css("border-top-right-radius"),
                    "border-top-right-radius": $searchField.css("border-top-left-radius"),
                    "border-bottom-left-radius": $searchField.css("border-bottom-right-radius"),
                    "border-bottom-right-radius": $searchField.css("border-bottom-left-radius")
                });
            }

            var $contentBody = $("#contentBody");
            if ($contentBody.css("direction") == "rtl") {
                $contentBody.css({
                    "border-top-left-radius": $contentBody.css("border-top-right-radius"),
                    "border-top-right-radius": $contentBody.css("border-top-left-radius")
                });
            }
        }

        // Apply placeholder polyfill
        $("input, textarea").placeholder();

        // Set up navigation tabs click handlers
        $(".tabs .tabs-nav li").click(NavTabs_Click);

        // Set up home button
        $("#home").click(GoHome);

        // Set up search
        $(".search-submit").click(function (e) {
            SearchFormSubmit(true);
        });
        $("#search-field").keypress(function (e) {
            if (e.which != 13)
                return;

            SearchFormSubmit(true);

            e.preventDefault();
        });
        $("#search-field-sidebar").keypress(function (e) {
            if (e.which != 13)
                return;

            SearchFormSubmit(false);

            e.preventDefault();
        });
        $(".search-filter").click(function (e) {
            $(this).addClass("open");

            if (window.PIE) {
                // When a filter is selected it causes the search bar width to change. PIE wasn't automatically detecting this and re-rendering as it should have been.
                // So instead, manually detach and re-attach to workaround this.
                $(".search-submit-wrapper").each(function () {
                    PIE.detach(this);
                    PIE.attach(this);
                });
            }

            var $filterContent = $(".search-filter-content", this);
            $filterContent.fadeIn(200);
            $filterContent.css("max-height", $(window).height() - $filterContent.offset().top);
        });
        var timer = null;
        $(".search-filter").mouseenter(function (e) {
            clearTimeout(timer);
        });
        $(".search-filter").mouseleave(function (e) {
            var $searchFilter = $(this);
            var $searchFilterContent = $(".search-filter-content", this);

            timer = setTimeout(function () {
                $searchFilterContent.fadeOut(200, function () {
                    $searchFilter.removeClass("open");
                });
            }, 500);
        });
        $(".search-filter-content").click(ReDoSearch);

        // Set up the resize bar
        $("#navigationResizeBar").mousedown(NavigationResizeBar_MouseDown);
        $("#show-hide-navigation").click(ShowHideNavigation_Click);
        AdjustTabs(parseInt($("#navigation").css("width")));

        // Store the page title. Each topic title will be appended to it when they're loaded.
        var $title = $("title");
        $title.attr("data-title", document.title);

        // Set up the topic onload handler
        $("#topic").load(function () {
            // Zero out the topic rating
            SetFeedbackRating(0);

            // Add the topic title to the page title
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "get-title", null, function (data) {
                var defaultTitle = $title.attr("data-title");
                var newTitle = defaultTitle;

                if (!MadCap.String.IsNullOrEmpty(defaultTitle))
                    newTitle += " - ";

                document.title = newTitle + data[0];
            });

            //            // Enable/disable the previous/next buttons
            //            GetAdvanceUrl("previous", function (href)
            //            {
            //                $(".previous-topic-button").attr("disabled", href == null ? "disabled" : null);
            //            });
            //            GetAdvanceUrl("next", function (href)
            //            {
            //                $(".next-topic-button").attr("disabled", href == null ? "disabled" : null);
            //            });

            // Update current topic index
            //UpdateCurrentTopicIndex();

            // Request the topic ID from the topic iframe
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "get-topic-id", null, function (data) {
                _TopicID = data[0];

                if (_TopicID != null) {
                    // Get the topic rating
                    UpdateRating();
                }
            });
        });

        // Set up buttons
        $(".print-button").click(function (e) {
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "print");
        });

        $(".expand-all-button").click(function (e) {
            var $this = $(this);

            if ($this.hasClass("expand-all-button"))
                MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "expand-all");
            else if ($this.hasClass("collapse-all-button"))
                MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "collapse-all");

            ToggleButtonState(this);
        });
        $(".remove-highlight-button").click(function (e) {
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "remove-highlight");
        });

        $(".previous-topic-button").click(function (e) {
            //_TocPane.NavigateTopic("previous");
            PreviousTopic();
        });

        $(".next-topic-button").click(function (e) {
            //_TocPane.NavigateTopic("next");
            NextTopic();
        });

        $lastActiveTab = $(document).find(".tab")[0];

        // Load the help system
        MadCap.WebHelp.HelpSystem.LoadHelpSystem("Data/HelpSystem.xml", function (helpSystem) {
            _HelpSystem = helpSystem;

            if (_HelpSystem.LiveHelpEnabled) {
                _FeedbackController = new MadCap.WebHelp.FeedbackController(_HelpSystem.LiveHelpServer);
                _FeedbackController.Init(function () {
                    if (_FeedbackController.PulseActive) {
                        $(document.documentElement).addClass('pulse-active');

                        // extra call to adjust tabs for community tab
                        AdjustTabs(parseInt($("#navigation").css("width")));
                    }

                    if (_FeedbackController.FeedbackActive) {
                        $(document.documentElement).addClass('feedback-active');

                        InitCommunityFeatures();
                    }
                });
            }

            if (!MadCap.String.IsNullOrEmpty(_HelpSystem.DefaultSkin.Tabs))
                LoadDefaultPane();

            // Load initial settings from hash
            if (document.location.hash.length > 1)
                LoadFromHash();
            else
                LoadFile(_HelpSystem.DefaultStartTopic);

            // Set the size of the browser if enabled in the skin
            SetSize(_HelpSystem.DefaultSkin);

            isResponsive = _HelpSystem.IsResponsive == 'undefined' ? isResponsive : _HelpSystem.IsResponsive;

            // load "media query"/resize breakpoints
            if (isResponsive) {
                var breakpoints = _HelpSystem.Breakpoints;
                tabletBreakpoint = breakpoints['Tablet'];
            }
            else {
                $("html").addClass("web");
            }

            // default to collapsed tabs on load in responsive layouts
            if ($(window).innerWidth() <= tabletBreakpoint && isResponsive) {
                GoHome();
            }

            // Load search filters
            _HelpSystem.LoadMergedSearchFilters(function (filterMap) {
                if (filterMap == null || filterMap.GetLength() == 0) {
                    if (window.PIE) {
                        $(".search-submit-wrapper").each(function () {
                            PIE.attach(this);
                        });
                    }

                    $("#SearchTab").closest('div').empty();
                    return;
                }

                $(".search-filter-wrapper").show();

                if (window.PIE) {
                    $(".search-filter, .search-submit-wrapper").each(function () {
                        PIE.attach(this);
                    });
                }

                var filterNames = [];

                filterMap.ForEach(function (key, value) {
                    filterNames.push(key);
                    return true;
                });

                filterNames.sort();

                if ($(".search-bar").css('display') == 'none')
                {
                    $("#SearchTab").closest(".tab").remove();
                    return;
                }

                var $ul = $("#search ul");
                for (var i = 0, length = filterNames.length; i < length; i++) {
                    $(".search-filter-content ul").append($("<li></li>").text(filterNames[i]));

                    var $li = $('<li/>');
                    $li.addClass('SearchFilterEntry tree-node tree-node-leaf');

                    var $item = $('<div class="SearchFilter" />');
                    var $span = $('<span class="label" />')
                    $span.text(filterNames[i]);

                    $item.append($span);

                    $li.append($item);
                    $ul.append($li);
                }

                // hookup on click event
                $(".SearchFilter").click(SetActiveSearchFilter);
            });
            
            Window_OnResize(e);
        });
    }

    function SetActiveSearchFilter(e) {
        var $target = $(e.target).closest('.SearchFilterEntry');

        $('.SearchFilterEntry.tree-node-selected').removeClass('tree-node-selected');

        if ($target.hasClass('SearchFilterEntry')) {
            $target.addClass('tree-node-selected');

            var filterName = $target.find('.SearchFilter').text();

            $('.search-filter span').text(filterName);

            $searchField = $('#search-field-sidebar');
            if (!$searchField.attr('data-placeholder'))
                $searchField.attr('data-placeholder', $searchField.attr('placeholder'));
            $searchField.attr('placeholder', $searchField.attr('data-placeholder') + ' ' + filterName);

            ReDoSearch(e);
        }
    }

    var timers = {};
    function WaitForFinalEvent(callback, ms, uniqueId) {
        if (!uniqueId) {
            uniqueId = "Don't call this twice without a uniqueId";
        }
        if (timers[uniqueId]) {
            clearTimeout(timers[uniqueId]);
        }
        timers[uniqueId] = setTimeout(callback, ms);
    }

    var lastWindowWidth = $(window).innerWidth();
    var lastWindowHeight = $(window).height();
    function Window_OnResize(e) {
        WaitForFinalEvent(function () {
            var windowWidth = $(window).innerWidth();
            
            if (isResponsive) {
                if (windowWidth > tabletBreakpoint) {
                    $("#navigation").removeAttr("role");
                    $("body").removeClass("active");
                    $("html").addClass("web");

                    if (lastWindowWidth <= tabletBreakpoint) {
                        GoHome();
                    }

                    // Bug fix #83772. Fixed tabs losing active class in desktop layout
                    if ($lastActiveTab) {
                        var $activeTab = $($lastActiveTab);

                        // check if any tab has 'active' on it
                        if (!$activeTab.hasClass("active")) {
                            var $activeLi = $activeTab.find("li");
                            var $li = $($activeLi[0]);

                            $li.removeClass('tabs-nav-inactive');
                            $li.addClass("tabs-nav-active");
                            $activeTab.addClass("active");
                        }
                    }
                    else if(!$lastActiveTab && $(document).find(".tab.active").length == 0) {
                        $lastActiveTab = $($(document).find(".tab")[0]);
                        SetActivePane("Toc", $lastActiveTab);
                    }
                }
                else {
                    if ($("#navigation").attr("role") !== 'undefined')
                        $("#navigation").attr("role", "complementary");

                    $("html").removeClass("web");
                }

                if (lastWindowWidth > tabletBreakpoint && windowWidth <= tabletBreakpoint || lastWindowWidth == windowWidth && lastWindowWidth <= tabletBreakpoint && lastWindowHeight == $(window).height()) {
                    var $activeTab = $('.tab.active');
                    $lastActiveTab = $activeTab.length && $activeTab.find('li').text() != "SearchTab" ? $('.tab.active') : $lastActiveTab;
                    $('.tab .tabs-nav-active').removeClass('tabs-nav-active');
                    $('.tabs-nav li').addClass('tabs-nav-inactive');
                    $('.tab.active').removeClass('active');
                }

                // only want to restore panes if it goes from desktop to mobile/tablet or vice versa
                if (lastWindowWidth > tabletBreakpoint && windowWidth <= tabletBreakpoint || lastWindowWidth <= tabletBreakpoint && windowWidth > tabletBreakpoint) {
                    RestorePanes($(window).innerWidth());
                }
            }
            AdjustTabs(parseInt($("#navigation").css("width")));
            lastWindowWidth = windowWidth;
            lastWindowHeight = $(window).height();
        }, 50, "FireOnce");
    }

    function RestorePanes(windowWidth) {
        var panePos = $(document.documentElement).hasClass("left-layout") ? "left" : $(document.documentElement).hasClass("right-layout") ? "right" : "left";

        var $navigation = $("#navigation");
        var $contentBody = $("#contentBody");
        var $navResizeBar = $("#navigationResizeBar");

        var noStyle = !$navigation.attr('style') || !$contentBody.attr('style');
        var noLastWidth = !$navigation.attr('data-mc-last-width') || !$contentBody.attr('data-mc-last-width');

        if (noStyle && noLastWidth)
            return;

        if (windowWidth > tabletBreakpoint) {
            var navWidth = $navigation.attr("data-mc-last-width");
            if (navWidth) {
                $navigation.css("width", navWidth);

                var contentWidth = $contentBody.attr("data-mc-last-width");
                if (contentWidth)
                    $contentBody.css(panePos, contentWidth);
            }
        }
        else {
            var navWidth = $navigation.css("width");
            if (navWidth) {
                $navigation.attr("data-mc-last-width", navWidth);
                
                $navigation.removeAttr("style");

                var contentWidth = $contentBody.css(panePos);
                if (contentWidth)
                    $contentBody.attr("data-mc-last-width", contentWidth);

                $contentBody.removeAttr("style");
            }
        }
    }

    function Window_Onhashchange(e) {
        MadCap.DEBUG.Log.AddLine(window.name + "onhashchange: " + document.location.hash);

        if (document.location.hash.length > 1)
            LoadFromHash();
        else
            LoadFile(_HelpSystem.DefaultStartTopic);
    }

    function InitCommunityFeatures() {
        // Set up topic rating mouse click event
        $(".star-buttons").click(FeedbackRating_Click);

        // Set the login/edit user profile button depending if the user is logged in
        UpdateLoginButton();

        $(".buttons").on("click", ".login-button", function (e) {
            _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, _FeedbackController.PulseEnabled ? "pulse" : "new");

            if (!_FeedbackController.PulseEnabled) {
                $(_LoginDialog).bind("closed", function () {
                    UpdateLoginButton();
                });
            }

            _LoginDialog.Show();
        });

        $(".buttons").on("click", ".edit-user-profile-button", function (e) {
            if (_FeedbackController.PulseEnabled) {
                document.location.hash = 'pulse-#!streams/' + _FeedbackController.PulseUserGuid + '/settings';
            }
            else {
                _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, "edit");

                $(_LoginDialog).bind("closed", function () {
                    UpdateLoginButton();
                });

                _LoginDialog.Show();
            }
        });
    }

    function SearchFormSubmit(isMainSearch) {
        var searchQuery = $("#search-field").val();
        if (!isMainSearch)
            searchQuery = $("#search-field-sidebar").val();
        
        searchQuery = MadCap.Utilities.Url.StripInvalidCharacters(searchQuery);

        if (!MadCap.String.IsNullOrEmpty(searchQuery)) {
            // hack because Safari encodes the url if we only assign the hash
            if (MadCap.IsSafari())
                searchQuery = encodeURIComponent(searchQuery);

            document.location.hash = "search-" + searchQuery;
        }
        else {
            document.location.hash = "";
        }        
    }

    function ReDoSearch(e) {
        var filterText = null;
        if ($("#search-field").is(":visible")) {
            filterText = $(e.target).text();
            $(this).prev().text(filterText);
        }
        else {
            filterText = $('.SearchFilter.active') && $('.SearchFilter.active').length ? $('.SearchFilter.active').text() : $.trim($(".search-filter li").first().text());
        }

        // if the search pane is currently active, redo the search to refresh the search results with the new filter applied
        if ($("#searchPane").is(":visible")) {
            var searchQuery = $("#search-field").val();

            if (MadCap.String.IsNullOrEmpty(searchQuery))
                return;

            DoSearch(searchQuery);
        }
    }

    function DoSearch(searchQuery, searchTopics, searchCommunity, communityPageSize, communityPageIndex) {
        // trim this because the trailing space from below will get copied here if the "all files" filter is selected from the dropdown
        var filterName = $(window).innerWidth() <= tabletBreakpoint && $(".SearchFilter.active") && $('.SearchFilter.active').length ? $.trim($(".SearchFilter.active").text()) : $.trim($(".search-filter span").text());
        var noFilterName = $.trim($(".search-filter li").first().text()); // trim this because in IE 7 there's a trailing space after the text for some reason

        if (typeof searchTopics == "undefined")
            searchTopics = true;
        if (typeof searchCommunity == "undefined")
            searchCommunity = _HelpSystem.DisplayCommunitySearchResults;
        if (typeof communityPageSize == "undefined")
            communityPageSize = _HelpSystem.CommunitySearchResultsCount;
        if (typeof communityPageIndex == "undefined")
            communityPageIndex = 0;

        if (filterName == noFilterName)
            filterName = null;

        $("#resultList").remove();

        ShowPane("search");

        if (searchTopics) {
            Search(searchQuery, filterName, function (results) {
                if (searchCommunity) {
                    CommunitySearch(searchQuery, filterName, communityPageSize, communityPageIndex, function (communityResults) {
                        BuildSearchResults(searchQuery, results, communityResults);
                    });
                }
                else {
                    BuildSearchResults(searchQuery, results, null);
                }
            });
        }
        else if (searchCommunity) {
            CommunitySearch(searchQuery, filterName, communityPageSize, communityPageIndex, function (communityResults) {
                BuildSearchResults(searchQuery, null, communityResults);
            });
        }
        
        // show search results
        $("body").removeClass("active");
    }

    function Search(searchQuery, filterName, OnCompleteFunc) {
        if (_SearchPane == null)
            _SearchPane = new MadCap.WebHelp.SearchPane(_HelpSystem);

        var $searchPane = $("#searchPane").addClass("loading");

        _SearchPane.Init(function () {
            _SearchPane.StartSearch(decodeURIComponent(searchQuery), filterName, function (resultSet) {
                var results = PrepareSearchResults(resultSet);

                $searchPane.removeClass("loading");

                if (OnCompleteFunc != null)
                    OnCompleteFunc(results);
            }, null);
        });
    }

    function CommunitySearch(searchQuery, filterName, pageSize, pageIndex, OnCompleteFunc) {
        if (_SearchPane == null)
            _SearchPane = new MadCap.WebHelp.SearchPane(_HelpSystem);

        var $searchPane = $("#searchPane").addClass("loading");

        _SearchPane.Init(function () {
            _SearchPane.StartPulseSearch(searchQuery, pageSize, pageIndex, function (results) {
                $searchPane.removeClass("loading");

                if (OnCompleteFunc != null)
                    OnCompleteFunc(results);
            });
        });
    }

    function PrepareSearchResults(resultSet) {
        var resultArray = [];

        for (var i = 0, length = resultSet.GetLength(); i < length; i++) {
            var result = resultSet.GetResult(i);
            var searchDBID = result.SearchDB;
            var title = null;
            var linkUrl = null;
            var abstractText = null;

            if (!_HelpSystem.IsWebHelpPlus) {
                var entry = result.Entry;
                var topicID = entry.TopicID;
                var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[searchDBID];
                title = searchDB.URLTitles[topicID] ? searchDB.URLTitles[topicID] : "";
                abstractText = searchDB.URLAbstracts[topicID];
                var path = searchDB.HelpSystem.GetPath();
                var file = searchDB.URLSources[topicID];
                var isFromPreMergedChildProject = MadCap.String.StartsWith(file, "/subsystems/", false);
                var isFromChildProject = !MadCap.String.IsNullOrEmpty(path) || isFromPreMergedChildProject;

                if (isFromChildProject && !_HelpSystem.MoveContentToRoot) // add "../" to search results from child projects
                    path = "../" + path;

                if (!isFromPreMergedChildProject)
                    path += "Data/";

                linkUrl = new MadCap.Utilities.Url(path).CombinePath(file);

                if (!isFromChildProject && !_HelpSystem.MoveContentToRoot)
                    linkUrl = linkUrl.ToRelative(_HelpSystem.ContentFolder);
            }
            else {
                title = result.Title;
                abstractText = result.AbstractText;
                var resultUrl = new MadCap.Utilities.Url(result.Link);
                var baseUrl = new MadCap.Utilities.Url(document.location.pathname);

                if (!MadCap.String.EndsWith(document.location.pathname, "/")) // http://MyServer/MyHTML5/ vs. http://MyServer/MyHTML5/Default.htm
                    baseUrl = baseUrl.ToFolder();

                baseUrl = baseUrl.CombinePath(_HelpSystem.ContentFolder);
                linkUrl = resultUrl.ToRelative(baseUrl);
            }

            resultArray[resultArray.length] = { Title: title, Link: linkUrl.FullPath, AbstractText: abstractText };
        }

        return resultArray;
    }

    function BuildSearchResults(searchQuery, results, communityResults) {
        var headingEl = $("#results-heading")[0];
        var length = (results != null ? results.length : 0);
        var totalLength = length + (communityResults != null ? communityResults.TotalRecords : 0);

        $(".query", headingEl).text("\"" + decodeURIComponent(searchQuery) + "\"");
        $(".total-results", headingEl).text(totalLength);

        var ul = document.createElement("ul");
        ul.setAttribute("id", "resultList");

        if (results == null)
            ul.setAttribute("class", "communitySearch");

        if (communityResults != null && communityResults.Activities.length > 0) {
            var li = document.createElement("li");
            li.setAttribute("id", "community-results");
            ul.appendChild(li);

            var h3 = document.createElement("h3");
            h3.setAttribute("class", "title");

            var communitySearchLink = document.createElement("a");
            communitySearchLink.setAttribute("href", "#communitysearch-" + searchQuery);
            communitySearchLink.appendChild(document.createTextNode("Community Results"));

            h3.appendChild(communitySearchLink);

            var communitySearchInfo = document.createElement("span");
            communitySearchInfo.appendChild(document.createTextNode(" (" + communityResults.TotalRecords + ")"));
            h3.appendChild(communitySearchInfo);

            var communityUl = document.createElement("ul");
            communityUl.setAttribute("id", "communityResultList");

            li.appendChild(h3);
            li.appendChild(communityUl);

            var now = new Date();
            var utcNow = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());

            for (var i = 0; i < communityResults.Activities.length; i++) {
                var communityResult = communityResults.Activities[i];

                var communityLi = document.createElement("li");
                communityUl.appendChild(communityLi);

                var communityLink = document.createElement("a");
                communityLink.setAttribute("class", "activityText");
                communityLink.setAttribute("href", "#pulse-#!streams/" + communityResult.FeedId + "/activities/" + communityResult.Id);
                communityLink.appendChild(document.createTextNode(communityResult.Text));

                var communityLinkInfo = document.createElement("div");
                communityLinkInfo.setAttribute("class", "activityInfo");

                var createdByA = document.createElement("a");
                createdByA.setAttribute("class", "activityCreator");
                createdByA.setAttribute("href", "#pulse-#!streams/" + communityResult.CreatedBy + "/activities");
                createdByA.appendChild(document.createTextNode(communityResult.CreatedByDisplayName));

                var toSpan = document.createElement("span");
                toSpan.appendChild(document.createTextNode(" to "));

                var feedUrl = communityResult.FeedUrl != null ? "#" + communityResult.FeedUrl : "#pulse-#!streams/" + communityResult.FeedId + "/activities";

                var pageA = document.createElement("a");
                pageA.setAttribute("class", "activityFeed");
                pageA.setAttribute("href", feedUrl);
                pageA.appendChild(document.createTextNode(communityResult.FeedName));

                var postedOn = new MadCap.Utilities.DateTime(communityResult.PostedUtc);
                var postedTimeSpan = new MadCap.Utilities.TimeSpan(postedOn.Date, utcNow);

                var postedOnSpan = document.createElement("span");
                postedOnSpan.setAttribute("class", "activityTime");
                postedOnSpan.appendChild(document.createTextNode(postedTimeSpan.ToDurationString()));

                communityLinkInfo.appendChild(createdByA);
                communityLinkInfo.appendChild(toSpan);
                communityLinkInfo.appendChild(pageA);
                communityLinkInfo.appendChild(postedOnSpan);

                communityLi.appendChild(communityLink);
                communityLi.appendChild(communityLinkInfo);
            }
        }

        if (results != null) {
            for (var i = 0; i < results.length; i++) {
                var result = results[i];
                var title = result.Title;
                var link = result.Link;
                var abstractText = result.AbstractText;

                var li = document.createElement("li");
                ul.appendChild(li);

                var h3 = document.createElement("h3");
                $(h3).addClass("title");
                li.appendChild(h3);

                var a = document.createElement("a");
                a.setAttribute("href", "#" + link + "?Highlight=" + searchQuery);
                a.appendChild(document.createTextNode(title));
                h3.appendChild(a);

                if (abstractText != null) {
                    var divDesc = document.createElement("div");
                    $(divDesc).addClass("description");
                    divDesc.appendChild(document.createTextNode(abstractText));
                    li.appendChild(divDesc);
                }

                var divUrl = document.createElement("div");
                $(divUrl).addClass("url");
                li.appendChild(divUrl);

                var cite = document.createElement("cite");
                cite.appendChild(document.createTextNode(link));
                divUrl.appendChild(cite);
            }
        }

        $(ul).appendTo($("#searchPane"));

        if (_HelpSystem.LiveHelpEnabled) {
            _FeedbackController.LogSearch(_HelpSystem.LiveHelpOutputId, null, length, null, searchQuery);
        }
    }

    function NavigationResizeBar_MouseDown(e) {
        MadCap.DEBUG.Log.AddLine("nav resizeBar : mousedown");

        if ($(e.target).attr("id") == "show-hide-navigation")
            return;

        if ($(this).hasClass("nav-closed"))
            return;

        var sheetEl = document.createElement("div");
        sheetEl.setAttribute("id", "mousemove-sheet");
        document.body.appendChild(sheetEl);

        $(document).mousemove(NavigationResizeBar_MouseMove);
        $(document).mouseup(NavigationResizeBar_MouseUp);
        $(document).bind("selectstart", NavigationResizeBar_SelectStart); // For IE 8 and below only. Prevent text selection.

        e.preventDefault(); // prevent text selection
    }

    function NavigationResizeBar_SelectStart(e) {
        return false;
    }

    function NavigationResizeBar_MouseMove(e) {
        MadCap.DEBUG.Log.AddLine("nav resizeBar : mousemove : " + e.pageX);

        var panePos = $(document.documentElement).hasClass("left-layout") ? "left" : $(document.documentElement).hasClass("right-layout") ? "right" : "left";
        var width = e.pageX;

        if (panePos == "right")
            width = window.innerWidth - e.pageX;

        ResizeNavigation(width);
    }

    function NavigationResizeBar_MouseUp(e) {
        MadCap.DEBUG.Log.AddLine("nav resizeBar : mouseup");

        $(document).off("mousemove", NavigationResizeBar_MouseMove);
        $(document).off("mouseup", NavigationResizeBar_MouseUp);
        $(document).off("selectstart", NavigationResizeBar_SelectStart);

        // IE needs this in a setTimeout(). Otherwise, you need to click the mouse again before you can select text, resize the resize bar, etc.
        var sheetEl = $("#mousemove-sheet")[0];
        window.setTimeout(function () { sheetEl.parentNode.removeChild(sheetEl); }, 1);
    }

    function ResizeNavigation(width) {
        var panePos = $(document.documentElement).hasClass("left-layout") ? "left" : $(document.documentElement).hasClass("right-layout") ? "right" : "left";

        if (panePos == "left") {
            if (width < 175 || width > (window.innerWidth * 0.85))
                return;
        }
        else if (panePos == "right") {
            if (width < (window.innerWidth * 0.15) || width > (window.innerWidth - 175))
                return;
        }

        AdjustTabs(width);

        $("#navigationResizeBar").css(panePos, width + "px");
        $("#navigation").css("width", width + "px");
        $("#contentBody").css(panePos, (width + 5) + "px")
    }

    function AdjustTabs(width) {
        var tabs = $(".tabs-nav li");
        $.each(tabs, function (index, item) {
            var li = $(item);
            if (li.hasClass("tab-collapsed"))
                li.removeClass("tab-collapsed");
        });
        if (width < CalculateTabsWidth() + 4) {
            for (var index = tabs.length - 1; index >= 0; index--) {
                var li = $(tabs[index]);
                li.addClass("tab-collapsed");
                if (width > CalculateTabsWidth() + 18) {
                    break;
                }
            }
        }
    }

    function CalculateTabsWidth() {
        var width = 0;
        var tabs = $(".tabs-nav li");
        tabs.each(function (index, li) {
            var tab = $(li);
            if (tab.is(':visible')) {
            width += parseInt(tab.css("width"));
            }
        });

        return width;
    }

    function GoHome() {
        var tabs = $(document).find('.tab');
        for (var i = 0; i < tabs.length; i++) {
            var $tab = $(tabs[i]);
            $tab.show();
            $tab.removeClass('active');
        }

        // reset search bar
        $("#search-sidebar").removeClass("index").removeClass("glossary");
        $(".tabs-nav-active").removeClass("tabs-nav-active");
        $(".tabs-nav li").addClass("tabs-nav-inactive");

        // reset index popups
        $(".responsive-link-list").remove();
    }

    function ShowHideNavigation_Click(e) {
        var $navigation = $("#navigation");

        if (!$navigation.hasClass("nav-closed"))
            ShowHideNavigation("hide");
        else
            ShowHideNavigation("show");
    }

    function ShowHideNavigation(which) {
        var panePos = $(document.documentElement).hasClass("left-layout") ? "left" : $(document.documentElement).hasClass("right-layout") ? "right" : "left";

        var $navigation = $("#navigation");
        var $navigationResizeBar = $("#navigationResizeBar");
        var $contentBody = $("#contentBody");

        if (which == "show") {
            $navigationResizeBar.css(panePos, $navigationResizeBar.attr("data-mc-last-width"));
            var contentBodyPos = $contentBody.attr("data-mc-last-width");
            // case for switching to responsive when nav pane is hidden
            if (contentBodyPos == $contentBody.css('left')) {
                contentBodyPos = $navigation.innerWidth() + $navigationResizeBar.innerWidth() + 1; // 1 for padding
                $contentBody.attr("data-mc-last-width", contentBodyPos + "px");
            }
            else {
                $contentBody.css(panePos, contentBodyPos);
            }

            $navigation.removeClass("nav-closed");
            $navigationResizeBar.removeClass("nav-closed");
            $contentBody.removeClass("nav-closed");

            if(isResponsive)
                RestorePanes($(window).innerWidth());
        }
        else if (which == "hide") {
            $contentBody.attr("data-mc-last-width", $contentBody.css(panePos)); // store current position
            //$contentBody.css(panePos, "5px");
            $contentBody.removeAttr("style");

            $navigationResizeBar.attr("data-mc-last-width", $navigationResizeBar.css(panePos)); // store current position
            $navigationResizeBar.css(panePos, 0);

            $navigation.attr("data-mc-last-width", $navigation.css('width')); // store current width

            $navigation.addClass("nav-closed");
            $navigationResizeBar.addClass("nav-closed");
            $contentBody.addClass("nav-closed");
        }
    }

    function LoadFromHash() {
        if (document.location.hash.length == 0)
            return;

        var path = MadCap.Utilities.Url.StripInvalidCharacters(document.location.hash);

        if (MadCap.String.IsNullOrEmpty(path)) {
            document.location.hash = "";
            return;
        }

        var topicPath = path.substring(1);
        topicPath = decodeURIComponent(topicPath);
        topicPath = MadCap.Utilities.Url.StripInvalidCharacters(topicPath);

        if (MadCap.String.Contains(topicPath, "cshid=") || MadCap.String.Contains(topicPath, "searchQuery=") || MadCap.String.Contains(topicPath, "skinName=")) {
            LoadCshFromHash();

            return;
        }
        else if (MadCap.String.StartsWith(topicPath, "search-")) {
            var searchQuery = topicPath.substring("search-".length);

            $("#search-field").val(searchQuery); // set the value of the search field. This needs to happen when the search originated directly from the URL rather than by typing in the search field and submitting.
            $("#search-field-sidebar").val(searchQuery);

            DoSearch(searchQuery);

            return;
        }
        else if (MadCap.String.StartsWith(topicPath, "communitysearch-")) {
            var searchQuery = topicPath.substring("communitysearch-".length);

            $("#search-field").val(searchQuery);
            $("#search-field-sidebar").val(searchQuery);

            DoSearch(searchQuery, false, true, -1, 0);

            return;
        }
        else if (MadCap.String.StartsWith(topicPath, "pulse-")) {
            var pulsePath = topicPath.substring("pulse-".length);

            LoadStream(pulsePath);

            return;
        }

        LoadTopic(topicPath);
    }

    function LoadTopic(path) {
        /// <summary>Loads a topic into the topic pane.</summary>
        /// <param name="path">The path of the topic relative to the Content folder.</param>

        var pathUrl = new MadCap.Utilities.Url(path);

        if (pathUrl.IsAbsolute) {
            //external url support - in case such a url has a query, this will strip off just our query.
            var iq1 = pathUrl.Query.indexOf('?');
            var iq2 = pathUrl.Query.lastIndexOf('?');
            var query = '';
            if (iq1 != iq2) {
                query = pathUrl.Query.substr(iq1, iq2);
            }
            if (pathUrl.FullPath.indexOf("http://") != 0) {
                path = _HelpSystem.ContentFolder + pathUrl.ToNoQuery().FullPath + (MadCap.String.IsNullOrEmpty(query) ? "" : query);
            } else {
                path = pathUrl.ToNoQuery().FullPath + (MadCap.String.IsNullOrEmpty(query) ? "" : query);
            }
        } else
            path = _HelpSystem.ContentFolder + pathUrl.ToNoQuery().FullPath;

        LoadFile(path);
    }

    function LoadFile(path) {
        /// <summary>Loads a file into the topic pane.</summary>
        /// <param name="path">The path of the file.</param>

        $(document.documentElement).addClass('has-topic');

        ShowPane("topic");

        // IE9 Bug for loading pdfs into a frame workaround
        // http://www.digiblog.de/2011/08/ie9-bug-loading-pdfs-into-frames-using-javascript/
        try{
            //conditional tries on msie fail due to the trident signature in newer IE
            frames["topic"].location.replace(path);
        }catch(err){
            document.getElementById("topic").src = path;
        }

        var href = new MadCap.Utilities.Url(decodeURIComponent(document.location.href));
        var tocType = null, tocPath = null, bsPath = null;

        if (!MadCap.String.IsNullOrEmpty(href.Fragment) && href.Fragment.length > 1) {
            tocPath = href.QueryMap.GetItem('TocPath');

            if (tocPath != null) {
                tocType = 'Toc';
            }
            else {
                bsPath = href.QueryMap.GetItem('BrowseSequencesPath');

                if (bsPath != null) {
                    tocType = 'BrowseSequences';
                }
            }

            if (href.HashMap.GetItem('cshid') == null) {
                var iq1 = href.Query.indexOf('?');
                var iq2 = href.Query.lastIndexOf('?');
                var query = '';
                if (iq1 != iq2) {
                    query = href.Query.substr(iq1, iq2);
                }
                href = new MadCap.Utilities.Url(href.Fragment.substr(1));
                if (!MadCap.String.IsNullOrEmpty(query)) {
                    href.Query = query;
                }
            }
        }
        else {
            href = new MadCap.Utilities.Url(_HelpSystem.DefaultStartTopic).ToRelative(_HelpSystem.GetContentPath());
        }

        _HelpSystem.SetBrowseSequencePath(bsPath, href);

        if (_HelpSystem.SyncTOC) {
            MadCap.Utilities.CrossFrame.PostMessageRequest(parent, 'sync-toc', [tocType, tocType == 'Toc' ? tocPath : bsPath, href.FullPath], null);
        }
    }

    function LoadStream(url) {
        /// <summary>Loads a stream into the Pulse pane.</summary>
        /// <param name="url">The stream url.</param>

        $(document.documentElement).removeClass('has-topic');

        ShowPane("pulse");

        var hash = url.substring(url.indexOf('#'));

        MadCap.Utilities.CrossFrame.PostMessageRequest(frames["community-frame-html5"], "pulse-hash-changed", [hash]);

        _FeedbackController.Init(function () {
            if (_FeedbackController.PulseActive)
                frames["pulse"].location.replace(_FeedbackController.PulseServer + hash);
        });
    }

    function LoadCshFromHash() {
        var hash = document.location.hash.substring(1);
        var hashMap = new MadCap.Utilities.Dictionary();
        var pairs = hash.split("&");
        $(pairs).each(function (index, value) {
            var kvp = pairs[index].split("=");
            hashMap.Add(kvp[0].toLowerCase(), kvp[1]); // case insensitive
        });

        var searchQuery = hashMap.GetItem("searchQuery".toLowerCase());

        if (searchQuery != null) {
            $("#search-field").val(decodeURIComponent(searchQuery)); // set the value of the search field
            $("#search-field-sidebar").val(decodeURIComponent(searchQuery)); 

            var firstPick = MadCap.String.ToBool(hashMap.GetItem("firstPick".toLowerCase()), false);

            if (firstPick) {
                Search(searchQuery, null, function (results) {
                    if (results.length >= 1)
                        LoadTopic(results[0].Link);
                });
            }
            else {
                DoSearch(searchQuery);
            }
        }
        else {
            var cshid = hashMap.GetItem("cshid");

            if (cshid != null) {
                _CSHID = cshid;

                _HelpSystem.LookupCSHID(cshid, function (idInfo) {
                    if (idInfo.Found)
                        LoadFile(idInfo.Topic);
                    else
                        LoadFile(_HelpSystem.DefaultStartTopic);

                    var skinName = hashMap.GetItem("skinName".toLowerCase()) || idInfo.Skin;

                    if (skinName != null) {
                        var skin = _HelpSystem.GetSkin(skinName);

                        ApplySkin(skin);
                    }
                });

                return;
            }
            else {
                LoadFile(_HelpSystem.DefaultStartTopic);
            }
        }

        var skinName = hashMap.GetItem("skinName".toLowerCase());

        if (skinName != null) {
            var skin = _HelpSystem.GetSkin(skinName);

            ApplySkin(skin);
        }
    }

    function GetPulsePathFromHash() {
        if (document.location.hash.indexOf("#pulse-") != 0)
            return "";

        return document.location.hash.substring("#pulse-".length);
    }

    function ApplySkin(skin) {
        SetSize(skin);

        if (MadCap.String.IsNullOrEmpty(skin.Tabs)) {
            $("#navigation").remove();
            $("#navigationResizeBar").remove();
            $(document.documentElement).removeClass("left-layout").removeClass("right-layout");
        }
        else {
            if (skin.WebHelpOptions != null && skin.WebHelpOptions.HideNavigationOnStartup != null && (MadCap.String.ToBool(skin.WebHelpOptions.HideNavigationOnStartup, false)))
                ShowHideNavigation("hide");

            if (skin.NavigationPanePosition != null && skin.NavigationPanePosition == "Right")
                $(document.documentElement).removeClass("left-layout").addClass("right-layout");

            if (skin.NavigationPaneWidth != null) {
                var navWidth = MadCap.String.ToInt(skin.NavigationPaneWidth, 300);

                ResizeNavigation(navWidth);
            }

            var tabs = skin.Tabs.split(",");
            var allTabs = ["TOC", "Index", "Glossary", "BrowseSequences", "Community"];
            var $tabsEl = $(".tabs");

            for (var i = 0, length = allTabs.length; i < length; i++) {
                var tab = allTabs[i];

                if ($.inArray(tab, tabs) >= 0)
                    continue;

                if (tab == "TOC") tab = "Toc";

                var $tab = $("#" + tab + "Tab");

                if ($tab.length == 0)
                    continue;

                var tabIndex = $tabsEl.children(".tabs-nav").children("li").index($tab); // can't use $tab.index() because CSS3PIE adds elements between the <li> elements in IE 8.
                var $panelEl = $tabsEl.children(".tabs-panels").children(":eq(" + tabIndex + ")");
                $tab.remove();
                $panelEl.remove();
            }

            var defaultTab = skin.DefaultTab;
            if (defaultTab == "TOC") defaultTab = "Toc";
            SetActivePane(defaultTab, $tabsEl);
            LoadPane(defaultTab);
        }

        if (skin.Toolbar != null && MadCap.String.IsNullOrEmpty(skin.Toolbar.Buttons)) {
            $(".buttons").remove();
            $("#contentBody").addClass("no-buttons");
        }

        if (skin.DisplaySearchBar == "false")
            $(".search-bar").hide();
    }

    function ShowPane(pane) {
        $("#topic").css("display", pane == "topic" ? "block" : "none");
        $("#pulse").css("display", pane == "pulse" ? "block" : "none");
        $("#searchPane").css("display", pane == "search" ? "block" : "none");
    }

    var currentSelection = null
    function NavTabs_Click(e) {
        var tabID = $(this).attr("id");
        var name = tabID.substring(0, tabID.length - "Tab".length);
        currentSelection = name;

        SetActivePane(name, $(this).closest('.tabs'));

        if ($(window).innerWidth() <= tabletBreakpoint && isResponsive) {
            var tabs = $(document).find('.tab');
            for (var i = 0; i < tabs.length; i++) {
                var $tab = $(tabs[i]);
                if (!$tab.hasClass('active')) {
                    $tab.hide();
                }
                else {
                    $tab.show();
                }
            }

            var $searchSidebar = $('#search-sidebar');
            var activeSearchClass = name.toLowerCase();
            $searchSidebar.removeClass('index').removeClass('glossary');
            if (activeSearchClass == 'index' || activeSearchClass == 'glossary') {
                $searchSidebar.addClass(activeSearchClass);
            }

        }

        // Load the pane
        LoadPane(name);
    }

    function SetActivePane(name, $tabsEl) {
        var $activeTabEl = $(".tabs-nav-active", $tabsEl);
        var $newActiveTab = $("#" + name + "Tab");
        var $currentActiveDiv = $activeTabEl.closest(".tab");
        var $newActiveDiv = $newActiveTab.closest(".tab");

        // set currently active tab to inactive
        $activeTabEl.removeClass("tabs-nav-active");
        $('.tabs-nav li').addClass('tabs-nav-inactive');

        // set currently active pane to inactive
        if ($currentActiveDiv != null)
            $currentActiveDiv.removeClass("active");

        // set new tab to active
        $newActiveTab.removeClass('tabs-nav-inactive');
        $newActiveTab.addClass("tabs-nav-active");

        // set new pane to active
        if ($newActiveDiv != null)
            $newActiveDiv.addClass("active");

        if (isResponsive && name != "Search") {
            $lastActiveTab = $(".tab.active");
    }
        else {
            $lastActiveTab = null;
        }
    }

    function LoadDefaultPane() {
        var name = _HelpSystem.DefaultSkin.DefaultTab;

        if (name == "TOC")
            LoadPane("Toc");
        else
            LoadPane(name);
    }

    function LoadPane(name) {
        var pane = null;
        if (name == "Toc")
            pane = LoadToc();
        else if (name == "Index")
            pane = LoadIndex();
        else if (name == "Glossary")
            pane = LoadGlossary();
        else if (name == "BrowseSequences")
            pane = LoadBrowseSequences();
        else if (name == "Community")
            pane = LoadCommunity();

        if (pane || (pane && isResponsive && $(window).innerWidth() > tabletBreakpoint)) {
            SetActivePane(name, pane);
    }

    }

    function LoadToc() {
        if (_TocPane != null)
            return;

        var $pane = $("#toc");
        $pane.addClass("loading");

        _TocPane = new MadCap.WebHelp.TocPane("Toc", _HelpSystem, $pane[0]);
        _TocPane.Init(function () {
            $pane.removeClass("loading");
        });

        return $pane.parent();
    }

    function LoadIndex() {
        if (_IndexPane != null)
            return;

        var $pane = $("#index");
        $pane.addClass("loading");

        _IndexPane = new MadCap.WebHelp.IndexPane(_HelpSystem);
        _IndexPane.Init($("#index .index-wrapper")[0], function () {
            $pane.removeClass("loading");
        });

        return $pane.parent();
    }

    function LoadGlossary() {
        if (_GlossaryPane != null)
            return;

        var $pane = $("#glossary");
        $pane.addClass("loading");

        _GlossaryPane = new MadCap.WebHelp.GlossaryPane(_HelpSystem);
        _GlossaryPane.Init($pane[0], function () {
            $pane.removeClass("loading");
        });

        return $pane.parent();
    }

    function LoadBrowseSequences() {
        if (_BrowseSequencesPane != null)
            return;

        var $pane = $("#browseSequences");
        $pane.addClass("loading");

        _BrowseSequencesPane = new MadCap.WebHelp.TocPane("BrowseSequences", _HelpSystem, $pane[0]);
        _BrowseSequencesPane.Init(function () {
            $pane.removeClass("loading");
        });

        return $pane.parent();
    }

    function LoadCommunity() {
        if (_CommunityLoaded)
            return;

        _CommunityLoaded = true;

        var $comFrame = $("#community-frame-html5");

        _FeedbackController.Init(function () {
            if (_FeedbackController.PulseActive)
                $comFrame.attr("src", _FeedbackController.PulseServer + "streams/my");
        });

        return $pane.parent();
    }

    function SetSize(skin) {
        var useDefaultSize = MadCap.String.ToBool(skin.UseBrowserDefaultSize, false);

        if (useDefaultSize)
            return;

        var topPx = MadCap.String.ToInt(skin.Top, 0);
        var leftPx = MadCap.String.ToInt(skin.Left, 0);
        var bottomPx = MadCap.String.ToInt(skin.Bottom, 0);
        var rightPx = MadCap.String.ToInt(skin.Right, 0);
        var widthPx = MadCap.String.ToInt(skin.Width, 800);
        var heightPx = MadCap.String.ToInt(skin.Height, 600);

        var anchors = skin.Anchors;

        if (anchors) {
            var aTop = (anchors.indexOf("Top") > -1) ? true : false;
            var aLeft = (anchors.indexOf("Left") > -1) ? true : false;
            var aBottom = (anchors.indexOf("Bottom") > -1) ? true : false;
            var aRight = (anchors.indexOf("Right") > -1) ? true : false;
            var aWidth = (anchors.indexOf("Width") > -1) ? true : false;
            var aHeight = (anchors.indexOf("Height") > -1) ? true : false;
        }

        if (aLeft && aRight)
            widthPx = screen.availWidth - (leftPx + rightPx);
        else if (!aLeft && aRight)
            leftPx = screen.availWidth - (widthPx + rightPx);
        else if (aWidth)
            leftPx = (screen.availWidth / 2) - (widthPx / 2);

        if (aTop && aBottom)
            heightPx = screen.availHeight - (topPx + bottomPx);
        else if (!aTop && aBottom)
            topPx = screen.availHeight - (heightPx + bottomPx);
        else if (aHeight)
            topPx = (screen.availHeight / 2) - (heightPx / 2);

        if (window == top) {
            window.resizeTo(widthPx, heightPx);
            window.moveTo(leftPx, topPx);
        }
    }

    function UpdateRating() {
        $(".star-buttons").addClass("loading");

        _FeedbackController.GetAverageRating(_TopicID, function (averageRating, ratingCount) {
            $(".star-buttons").removeClass("loading");

            SetFeedbackRating(averageRating);
        });
    }

    function SetFeedbackRating(rating) {
        var $starContainer = $(".star-buttons");
        var $stars = $(".star-button", $starContainer);
        var starCount = $stars.length;
        var numIcons = Math.ceil(rating * starCount / 100);

        $stars.css("opacity", 0);

        for (var i = 0; i < starCount; i++) {
            var starButton = $stars[i];
            var $starButton = $(starButton);

            window.setTimeout((function (i, $starButton) {
                return function () {
                    if (i <= numIcons - 1)
                        SetButtonState($starButton[0], 2);
                    else
                        SetButtonState($starButton[0], 1);

                    $starButton.animate({ opacity: 1 });
                }
            })(i, $starButton), i * 50);
        }
    }

    function FeedbackRating_Click(e) {
        var $target = $(e.target);

        if (e.target.tagName == "IMG")
            $target = $target.closest(".star-button");

        if ($target.hasClass("star-button")) {
            var starCount = $(".star-button", this).length;
            var rating = ($target.index() + 1) * 100 / starCount;

            _FeedbackController.SubmitRating(_TopicID, rating, null, function () {
                UpdateRating();
            });
        }
    }

    function AdvanceTopic(moveType) {
        GetAdvanceUrl(moveType, function (href) {
            if (href) {
                document.location.hash = href;
            }
        });
    }

    function PreviousTopic() {
        AdvanceTopic("previous");
    }

    function NextTopic() {
        AdvanceTopic("next");
    }

    function GetAdvanceUrl(moveType, CallBackFunc) {
        MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "get-topic-url", null, function (data) {
            var href = new MadCap.Utilities.Url(decodeURIComponent(data[0]));
            var root = new MadCap.Utilities.Url(decodeURIComponent(document.location.href));

            var tocPath = root.QueryMap.GetItem('TocPath');
            var bsPath = root.QueryMap.GetItem('BrowseSequencesPath');

            root = root.ToPlainPath();
            if (!root.IsFolder)
                root = root.ToFolder();

            var contentFolder = root.CombinePath(_HelpSystem.GetMasterHelpsystem().GetContentPath());
            href = href.ToRelative(contentFolder);

            if (bsPath != null) {
                _HelpSystem.AdvanceTopic("BrowseSequences", moveType, bsPath, href, CallBackFunc);
            }
            else {
                _HelpSystem.AdvanceTopic("Toc", moveType, tocPath, href, CallBackFunc);
            }
        });
    }

    function UpdateCurrentTopicIndex() {
        //        var span = document.getElementById("MCCurrentTopicIndexContainer");

        //        if (span == null)
        //        {
        //            return;
        //        }

        //        if (MCGlobals.InPreviewMode)
        //        {
        //            SetCurrentTopicIndexSequenceIndex(0);
        //            SetCurrentTopicIndexTotal(0);
        //            OnCompleteBoth();
        //        }
        //        else
        {
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "get-bs-path", null, function (data) {
                function OnCompleteGetEntrySequenceIndex(sequenceIndex) {
                    var $currentTopicIndex = $(".current-topic-index-button");

                    if (sequenceIndex == -1) {
                        $currentTopicIndex.addClass("disabled");

                        return;
                    }

                    $currentTopicIndex.removeClass("disabled");

                    $(".sequence-index").text(sequenceIndex);

                    file.GetIndexTotalForEntry(bsPath, href, function (total) {
                        $(".sequence-total").text(total);
                    });
                }

                var bsPath = data[0];
                var href = new MadCap.Utilities.Url(decodeURIComponenet(data[1]));
                var homeUrl = new MadCap.Utilities.Url(decodeURIComponent(document.location.href));
                homeUrl = new MadCap.Utilities.Url(homeUrl.PlainPath);
                var homeFolder = MadCap.String.EndsWith(homeUrl.FullPath, "/") ? homeUrl : homeUrl.ToFolder(); // Don't need .ToFolder() in the case that the page URL ends in a '/' (could happen when located on a web server: http://mydomain.com/WebHelp2/)
                href = href.ToRelative(homeFolder);

                if (bsPath != null) {
                    var fullBsPath = _HelpSystem.GetFullTocPath("browsesequences", href.FullPath);

                    if (fullBsPath)
                        bsPath = bsPath ? fullBsPath + "|" + bsPath : fullBsPath;
                }

                if (MadCap.String.IsNullOrEmpty(bsPath) || MadCap.String.StartsWith(bsPath, "_____")) {
                    OnCompleteGetEntrySequenceIndex(-1);

                    return;
                }

                var file = _HelpSystem.GetBrowseSequenceFile();
                file.GetEntrySequenceIndex(bsPath, href, OnCompleteGetEntrySequenceIndex);
            });
        }
    }

    function ToggleButtonState(buttonEl) {
        var $buttonEl = $(buttonEl);
        var currState = $buttonEl.attr("data-current-state") || "1";
        var nextState = currState == "1" ? 2 : 1;

        SetButtonState(buttonEl, nextState)
    }

    function SetButtonState(buttonEl, newState) {
        var $buttonEl = $(buttonEl);
        var currState = newState == 1 ? 2 : 1;
        var newStateClass = $buttonEl.attr("data-state" + newState + "-class");
        var currStateClass = $buttonEl.attr("data-state" + currState + "-class");

        $buttonEl.attr("data-current-state", newState);
        $buttonEl.removeClass(currStateClass).addClass(newStateClass);
        $buttonEl.attr("title", $buttonEl.attr("data-state" + newState + "-title"));
    }

    function UpdateLoginButton() {
        _UserGuid = _FeedbackController.GetUserGuid();

        var $el = $('.login-button');
        if ($el.length == 0)
            $el = $('.edit-user-profile-button');

        SetButtonState($el[0], _UserGuid == null ? 1 : 2);
    }

    function CloseLoginDialog() {
        if (_LoginDialog != null) {
            _LoginDialog.Hide(true);
        }
    }

    function MovePage(direction) {
        var $body = $('body');
        var isLeftLayout = $('html').hasClass('left-layout');
        var isActiveBody = $body.hasClass('active');

        if (isLeftLayout) {
            if (direction == 'left' && isActiveBody) {
                $body.removeClass('active');
            }
            else if (direction == 'right') {
                $body.addClass('active');
            }
        }
        else {
            if (direction == 'right' && isActiveBody) {
                $body.removeClass('active');
            }
            else if (direction == 'left') {
                $body.addClass('active');
            }
        }
    }

    MadCap.Utilities.CrossFrame.AddMessageHandler(function (message, dataValues, responseData, messageSource, messageID) {
        var returnData = { Handled: false, FireResponse: true };

        if (message == "get-href") {
            responseData[responseData.length] = document.location.href;

            //

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        if (message == "get-return-url") {
            var url = new MadCap.Utilities.Url(document.location.href);
            var returnUrl = null;

            if (url.Fragment.length > 1) {
                var href = new MadCap.Utilities.Url(url.Fragment.substring(1));
                returnUrl = url.QueryMap.GetItem('returnUrl');
            }

            responseData[responseData.length] = returnUrl;

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "navigate") {
            var path = dataValues[0];

            if (path) 
                document.location.hash = MadCap.Utilities.Url.StripInvalidCharacters(path);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "navigate-topic") {
            var path = dataValues[0];

            var href = new MadCap.Utilities.Url(path);

            if (href.IsAbsolute) {
                // path will be absolute so make it relative to the home folder
                var homeUrl = new MadCap.Utilities.Url(document.location.href);
                homeUrl = new MadCap.Utilities.Url(homeUrl.PlainPath);
                var homeFolder = MadCap.String.EndsWith(homeUrl.FullPath, "/") ? homeUrl : homeUrl.ToFolder(); // Don't need .ToFolder() in the case that the page URL ends in a '/' (could happen when located on a web server: http://mydomain.com/WebHelp2/)
                var contentFolder = homeFolder.CombinePath(_HelpSystem.ContentFolder);
                href = href.ToRelative(contentFolder);
            }

            if (href.FullPath)
                document.location.hash = MadCap.Utilities.Url.StripInvalidCharacters(href.FullPath);

            returnData.Handled = true;
        }
        else if (message == "navigate-home") {
            var url = new MadCap.Utilities.Url(document.location.href);

            document.location.href = url.PlainPath;

            returnData.Handled = true;
        }
        else if (message == "navigate-pulse") {
            var path = dataValues[0];

            // append returnUrl if register/forgotpassword
            if (document.location.hash.length > 1 && path) {
                var lowerPath = path.toLowerCase();

                if (lowerPath === 'feedback/account/register' || path.toLowerCase() === 'forgotpassword') {
                    var url = new MadCap.Utilities.Url(document.location.hash.substring(1));
                    var returnUrl = url.QueryMap.GetItem('returnUrl');

                    if (returnUrl != null) {
                        returnUrl = escape(returnUrl);
                    }
                    else {
                        returnUrl = document.location.hash.substring(1);
                    }

                    path += '?returnUrl=' + returnUrl;
                }
            }

            if (path)
                document.location.hash = "pulse-" + MadCap.Utilities.Url.StripInvalidCharacters(path);

            returnData.Handled = true;
        }
        else if (message == "navigate-previous") {
            PreviousTopic();

            returnData.Handled = true;
        }
        else if (message == "navigate-next") {
            NextTopic();

            returnData.Handled = true;
        }
        else if (message == "login-user" || message == "login-pulse") {
            if (_UserGuid == null) {
                var mode = message == "login-pulse" ? "pulse" : "new";
                _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, mode);

                if (mode == "new") {
                    $(_LoginDialog).bind("closed", function () {
                        UpdateLoginButton();

                        responseData[responseData.length] = _UserGuid;

                        MadCap.Utilities.CrossFrame._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
                    });
                }

                _LoginDialog.Show();

                //

                returnData.Handled = true;
                returnData.FireResponse = false;
            }
            else {
                responseData[responseData.length] = _UserGuid;

                //

                returnData.Handled = true;
                returnData.FireResponse = true;
            }
        }
        else if (message == "get-csh-id") {
            responseData[responseData.length] = _CSHID;

            //

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "get-user-guid") {
            responseData[responseData.length] = _UserGuid;

            //

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "get-topic-path-by-stream-id") {
            var streamID = dataValues[0];

            _FeedbackController.GetTopicPathByStreamID(streamID, function (topicPath) {
                responseData[responseData.length] = topicPath;

                MadCap.Utilities.CrossFrame._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
            }, null, null);

            //

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "get-topic-path-by-page-id") {
            var pageID = dataValues[0];

            _FeedbackController.GetTopicPathByPageID(pageID, function (topicPath) {
                responseData[responseData.length] = topicPath;

                MadCap.Utilities.CrossFrame._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
            }, null, null);

            //

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "hash-changed") {
            var newHash = dataValues[0];
            newHash = newHash.substring(1);

            history.pushState(null, null, document.location.pathname + document.location.hash + "$" + newHash);

            //

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "forward-ajax-open-success") {
            var data = dataValues[0];
            var status = parseInt(dataValues[1]);
            var dest = dataValues[2];

            ShowPane("pulse");

            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["pulse"], "ajax-open-success", [data, status, dest]);

            //

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "get-pulse-hash") {
            var pulseHash = "";

            if (document.location.hash.indexOf('#pulse-') == 0)
                pulseHash = document.location.hash.substring('#pulse-'.length);

            responseData[responseData.length] = pulseHash;

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "login-complete" || message == "logout-complete") {
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["pulse"], "reload");
            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["community-frame-html5"], "reload");

            MadCap.Utilities.CrossFrame.PostMessageRequest(frames["topic"], "reload-pulse");

            CloseLoginDialog();
            UpdateLoginButton();

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "close-login-dialog") {
            CloseLoginDialog();

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "set-pulse-login-id") {
            if (_FeedbackController != null)
                _FeedbackController.PulseUserGuid = dataValues[0];

            UpdateLoginButton();

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "touch-swipe") {
            MovePage(dataValues[0]);

            returnData.Handled = true;
            returnData.FireResponse = false;
        }
        else if (message == "get-parent-window-width") {
            responseData[responseData.length] = $(window).innerWidth();

            returnData.Handled = true;
            returnData.FireResponse = true;
        }

        return returnData;
    }, null);

    $(Window_Onload);
    $(window).resize(Window_OnResize);

    $(window).hashchange(Window_Onhashchange); // hashchange polyfill

    var _TocPane = null;
    var _IndexPane = null;
    var _SearchPane = null;
    var _GlossaryPane = null;
    var _BrowseSequencesPane = null;
    var _CommunityLoaded = null;
    var _HelpSystem = null;
    var _FeedbackController = null;
    var _TopicID = null;
    var _UserGuid = null;
    var _CSHID = null;
    var _LoginDialog = null;
})();
