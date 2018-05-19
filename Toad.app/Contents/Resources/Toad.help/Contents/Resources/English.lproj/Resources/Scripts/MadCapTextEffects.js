/// <reference path="jquery.js" />
/// <reference path="MadCapGlobal.js" />

/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
*
* v10.0.0.0
*/

(function () {
    MadCap.CreateNamespace("TopicHelpers");

    var TopicHelpers = MadCap.TopicHelpers;

    // TextEffectControl

    TopicHelpers.TextEffectControl = function (el, className) {
        if (this._rootEl == null) {
            this._rootEl = el;
        }

        this._hotSpotEl = null;
        this._bodyEls = null;
        this._className = className;

        TopicHelpers.TextEffectControl.Controls[TopicHelpers.TextEffectControl.Controls.length] = this;

        var _self = this;

        (function () {
            _self._hotSpotEl = MadCap.Dom.GetElementsByClassName(_self._className + "HotSpot", null, _self._rootEl)[0];
            _self._bodyEls = MadCap.Dom.GetElementsByClassName(_self._className + "Body", null, _self._rootEl);
            
            $(_self._hotSpotEl).click(function (e) { _self.Toggle.call(_self); });
        })();
    };

    // Statics

    TopicHelpers.TextEffectControl.Controls = new Array();

    TopicHelpers.TextEffectControl.FindControl = function (el) {
        for (var i = 0; i < TopicHelpers.TextEffectControl.Controls.length; i++) {
            if (TopicHelpers.TextEffectControl.Controls[i]._rootEl == el) {
                return TopicHelpers.TextEffectControl.Controls[i];
            }
        }

        return null;
    };

    TopicHelpers.TextEffectControl.ExpandAll = function (swapType) {
        for (var i = 0, length = TopicHelpers.TextEffectControl.Controls.length; i < length; i++) {
            var control = TopicHelpers.TextEffectControl.Controls[i];

            if (swapType == "open")
                control.Open(false);
            else if (swapType == "close")
                control.Close(false);
        }
    };

    // Functions

    TopicHelpers.TextEffectControl.prototype.Open = function () {
        var $rootEl = $(this._rootEl);
        $rootEl.removeClass(this._className + "_Closed");
        $rootEl.addClass(this._className + "_Open");

        var imgClass = null;
        if ($rootEl.hasClass("MCToggler")) {
            imgClass = $(".MCToggler_Image_Icon");
        }
        else if ($rootEl.hasClass("MCDropDown")) {
            imgClass = $(".MCDropDown_Image_Icon");
        }
        else if ($rootEl.hasClass("MCExpanding")) {
            imgClass = $(".MCExpanding_Image_Icon");
        }
        
        var $img = $rootEl.find(imgClass);
        this.ToggleAltText($img[0], $rootEl, "closed");

        $rootEl.attr("data-mc-state", "open");
    };

    TopicHelpers.TextEffectControl.prototype.Close = function () {
        var $rootEl = $(this._rootEl);
        $rootEl.removeClass(this._className + "_Open");
        $rootEl.addClass(this._className + "_Closed");

        var imgClass = null;
        if ($rootEl.hasClass("MCToggler")) {
            imgClass = $(".MCToggler_Image_Icon");
        }
        else if ($rootEl.hasClass("MCDropDown")) {
            imgClass = $(".MCDropDown_Image_Icon");
        }
        else if ($rootEl.hasClass("MCExpanding")) {
            imgClass = $(".MCExpanding_Image_Icon");
        }

        var $img = $rootEl.find(imgClass);
        this.ToggleAltText($img[0], $rootEl, "open");

        $rootEl.attr("data-mc-state", "closed");
    };

    TopicHelpers.TextEffectControl.prototype.ToggleAltText = function (imgEl, rootEl, state) {
        if (imgEl != null) {
            var $imgEl = $(imgEl);

            var alt2 = $imgEl.attr("data-mc-alt2");
            var alt = $imgEl.attr("alt");

            if (rootEl != null && rootEl.attr("data-mc-state") == state) {
                $imgEl.attr("alt", alt2);
                $imgEl.attr("data-mc-alt2", alt);
            }
        }
    }

    TopicHelpers.TextEffectControl.prototype.Toggle = function () {
        var $rootEl = $(this._rootEl);
        var state = $rootEl.attr("data-mc-state") || "closed";
        var newState = null;

        if (state == "open") {
            this.Close(true);
        }
        else if (state == "closed") {
            this.Open(true);
        }

        $($rootEl.find("a")[0]).focus();
    };

    // ExpandingControl

    $(function () {
        var expandings = $(".MCExpanding");

        for (var i = 0, length = expandings.length; i < length; i++) {
            var expandingEl = expandings[i];
            var expanding = new MadCap.TopicHelpers.ExpandingControl(expandingEl);
            expanding.Init();
        }
    });

    TopicHelpers.ExpandingControl = function (el) {
        TopicHelpers.TextEffectControl.call(this, el, "MCExpanding");
    };

    MadCap.Extend(TopicHelpers.TextEffectControl, TopicHelpers.ExpandingControl);

    TopicHelpers.ExpandingControl.prototype.Init = function () {
        this.Close(false);
    };

    TopicHelpers.ExpandingControl.prototype.Open = function (shouldAnimate) {
        this.base.Open.call(this);
        var $bodyEls = $(this._bodyEls[0]);
        $bodyEls.css({ "white-space": "nowrap" });

        if (shouldAnimate) {
            $bodyEls.hide().animate({ width: "show" }, function () {
                $(this).css({ "white-space": "normal" });
            });
        }
        else {
            $bodyEls.show();
        }
    };

    TopicHelpers.ExpandingControl.prototype.Close = function (shouldAnimate) {
        if (!shouldAnimate) {
            $(this._bodyEls[0]).hide();
            this.base.Close.call(this);

            return;
        }

        var self = this;

        $(this._bodyEls[0]).css({ "white-space": "nowrap" }).animate({ width: "hide" }, function () {
            $(this).css({ "white-space": "normal" });

            self.base.Close.call(self);
        });
    };

    // DropDownControl

    $(function () {
        var dropDowns = $(".MCDropDown");

        for (var i = 0, length = dropDowns.length; i < length; i++) {
            var dropDownEl = dropDowns[i];
            var dropDown = new MadCap.TopicHelpers.DropDownControl(dropDownEl);
            dropDown.Init(false);
        }
    });

    TopicHelpers.DropDownControl = function (el) {
        TopicHelpers.TextEffectControl.call(this, el, "MCDropDown");
    };

    MadCap.Extend(TopicHelpers.TextEffectControl, TopicHelpers.DropDownControl);

    TopicHelpers.DropDownControl.prototype.Init = function () {
        this.Close(false);
    };

    TopicHelpers.DropDownControl.prototype.Open = function (shouldAnimate) {
        this.base.Open.call(this);
        var $bodyEl = $(this._bodyEls[0]);
        if (shouldAnimate)
            $bodyEl.hide().slideDown();
        else
            $bodyEl.show();
    };

    TopicHelpers.DropDownControl.prototype.Close = function (shouldAnimate) {
        if (!shouldAnimate) {
            $(this._bodyEls[0]).hide();
            this.base.Close.call(this);

            return;
        }

        var self = this;

        $(this._bodyEls[0]).slideUp(function () {
            self.base.Close.call(self);
        });
    };

    // TogglerControl

    $(function () {
        var togglers = $(".MCToggler");

        for (var i = 0, length = togglers.length; i < length; i++) {
            var togglerEl = togglers[i];
            var toggler = new MadCap.TopicHelpers.TogglerControl(togglerEl);
            toggler.Init();
        }
    });

    TopicHelpers.TogglerControl = function (el) {
        this._rootEl = el;
        this._hotSpotEl = el;
        this._bodyEls = new Array();
        this._className = "MCToggler";

        TopicHelpers.TextEffectControl.Controls[TopicHelpers.TextEffectControl.Controls.length] = this;

        var _self = this;

        (function () {
            var targetsVal = MadCap.Dom.Dataset(_self._rootEl, "mcTargets");
            var targets = targetsVal.split(";");

            for (var i = 0, length = targets.length; i < length; i++) {
                var target = targets[i];
                var els = MadCap.Dom.GetElementsByAttribute("data-mc-target-name", target, null, document.body);

                _self._bodyEls = _self._bodyEls.concat(els);
            }

            $(_self._hotSpotEl).click(function (e) { _self.Toggle.call(_self); });
        })();
    };

    MadCap.Extend(TopicHelpers.TextEffectControl, TopicHelpers.TogglerControl);

    TopicHelpers.TogglerControl.prototype.Init = function () {
        this.Close(false);
    };

    TopicHelpers.TogglerControl.prototype.Open = function (animate) {
        this.base.Open.call(this);

       
            for (var i = 0, length = this._bodyEls.length; i < length; i++) {
                if (animate) {
                    $(this._bodyEls[i]).css({ opacity: 0, display: "" });
                    $(this._bodyEls[i]).animate(
                        {
                            opacity: 1
                        },
                        200);
                }
                else {
                    $(this._bodyEls[i]).css({ opacity: 1, display: "" });
                }
        }
    };

    TopicHelpers.TogglerControl.prototype.Close = function (animate) {
        this.base.Close.call(this);

        function HideEl(el) {
            $(el).css("display", "none");
        }

        for (var i = 0, length = this._bodyEls.length; i < length; i++) {
            var self = this;

            if (animate) {
                $(this._bodyEls[i]).animate(
                {
                    opacity: 0
                },
                200,
                function () {
                    HideEl(this);
                });
            }
            else {
                HideEl(this._bodyEls[i]);
            }
        }
    };

    // TextPopupControl

    $(function () {
        var textPopups = $(".MCTextPopup");

        for (var i = 0, length = textPopups.length; i < length; i++) {
            var textPopupEl = textPopups[i];
            var textPopup = new MadCap.TopicHelpers.TextPopupControl(textPopupEl);
            textPopup.Init();
        }
    });

    TopicHelpers.TextPopupControl = function (el) {
        this._rootEl = el;
        this._hotSpotEl = el;
        this._bodyEls = null;
        this._className = "MCTextPopup";

        var _self = this;

        (function () {
            _self._bodyEls = $("." + _self._className + "Body", _self._rootEl).toArray();

            $(_self._hotSpotEl).mouseover(function (e) { _self.Open(); });
            $(_self._hotSpotEl).mouseleave(function (e) { _self.Close(); });
        })();
    };

    MadCap.Extend(TopicHelpers.TextEffectControl, TopicHelpers.TextPopupControl);

    TopicHelpers.TextPopupControl.prototype.Init = function () {
        this.Close(false);
    };

    TopicHelpers.TextPopupControl.prototype.Open = function () {
        this.base.Open.call(this);

        var $popupSpot = $(this._rootEl);
        var $popupBodyEl = $(this._bodyEls[0]);
        var $popupArrowEl = $(".MCTextPopupArrow", $popupSpot);
        var $win = $(window);

        $popupBodyEl.css("top", "0");
        $popupBodyEl.css("left", "0");

        // reset the height that may have been set when previously opening the text popup if it didn't fit
        $popupBodyEl.css("height", "auto");

        // Place the popup body centered below/above the text
        var ARROW_HEIGHT = 13;
        var offsetRootTop = $popupBodyEl.offset().top;
        var offsetRootLeft = $popupBodyEl.offset().left;
        var offsetTop = $popupSpot.offset().top - offsetRootTop;
        var offsetLeft = $popupSpot.offset().left - offsetRootLeft;
        var bottom = offsetTop + this._rootEl.offsetHeight;
        var popupWidth = $popupBodyEl[0].offsetWidth;
        var popupHeight = $popupBodyEl[0].offsetHeight;
        var middle = offsetLeft + ($popupSpot[0].offsetWidth / 2);
        var left = middle - (popupWidth / 2);
        var right = left + popupWidth;
        var top = bottom + ARROW_HEIGHT;
        var scrollTop = $win.scrollTop();
        var scrollLeft = $win.scrollLeft();
        var arrowMarginLeft = -$popupArrowEl[0].offsetWidth / 2;
        var outerWidth = $win.width();

        var heightBelow = scrollTop + $win.height() - bottom;

        if ((popupHeight + ARROW_HEIGHT) > heightBelow) // can't fit below
        {
            var heightAbove = offsetTop - scrollTop;

            if ((popupHeight + ARROW_HEIGHT) > heightAbove) // can't fit above
            {
                top = bottom; // in this case place the popup immediately below the popup text so the user can move the mouse into it to scroll without it disappearing
                var borderTop = parseInt($popupBodyEl.css("border-top-width"));
                var borderBottom = parseInt($popupBodyEl.css("border-bottom-width"));
                var paddingTop = parseInt($popupBodyEl.css("padding-top"));
                var paddingBottom = parseInt($popupBodyEl.css("padding-bottom"));
                $popupBodyEl.css("height", (heightBelow - borderTop - borderBottom - paddingTop - paddingBottom) + "px");
                $popupBodyEl.css("overflow", "auto");
            }
            else {
                $popupBodyEl.addClass("MCTextPopupBodyBottom");

                top = offsetTop - popupHeight - ARROW_HEIGHT;
            }
        }
        else {
            $popupBodyEl.removeClass("MCTextPopupBodyBottom");
        }

        $popupBodyEl.css("top", top + "px");

        if (right >= outerWidth + scrollLeft)
            arrowMarginLeft += (right - outerWidth - scrollLeft);

        if (left < scrollLeft)
            arrowMarginLeft += (left - scrollLeft);

        left = Math.min(left, scrollLeft + outerWidth - popupWidth);
        left = Math.max(left, scrollLeft);
        $popupBodyEl.css("left", left + "px");
        $popupArrowEl.css("margin-left", arrowMarginLeft + "px");

        // Animate it
        $popupBodyEl.animate(
        {
            opacity: 1
        }, 200);
    };

    TopicHelpers.TextPopupControl.prototype.Close = function () {
        this.base.Close.call(this);

        var $popupBodyEl = $(this._bodyEls[0]);
        $popupBodyEl.css("opacity", 0);
    };

    // TopicPopupControl

    $(function () {
        var $topicPopups = $(".MCTopicPopup");

        for (var i = 0, length = $topicPopups.length; i < length; i++) {
            var topicPopupEl = $topicPopups[i];
            var topicPopup = new MadCap.TopicHelpers.TopicPopupControl(topicPopupEl);
            topicPopup.Init();
        }
    });

    TopicHelpers.TopicPopupControl = function (el) {
        this._rootEl = el;
        this._hotSpotEl = el;
        this._bodyEls = null;
        this._className = "MCTopicPopup";

        var _self = this;

        (function () {
            _self._bodyEls = $("." + _self._className + "Body", _self._rootEl).toArray();

            $(_self._hotSpotEl).click(function (e) {
                _self.Open();

                $(document.documentElement).click(function (e) {
                    _self.Close();

                    $(document.documentElement).off("click", arguments.callee);
                });

                e.stopPropagation(); // Adding the event listener above will cause the current click to also fire the above handler. Call e.stopPropagation() to prevent that.

                MadCap.Utilities.PreventDefault(e); // prevents link from navigating
            });
        })();
    };

    MadCap.Extend(TopicHelpers.TextEffectControl, TopicHelpers.TopicPopupControl);

    TopicHelpers.TopicPopupControl.prototype.Init = function () {
        this.Close(false);
    };

    TopicHelpers.TopicPopupControl.prototype.Open = function () {
        this.base.Open.call(this);

        var $containerEl = $("<div></div>");
        $containerEl.addClass("MCTopicPopupContainer needs-pie");

        var href = MadCap.Dom.GetAttribute(this._hotSpotEl, "href");
        var iframeEl = document.createElement("iframe");
        $(iframeEl).addClass("MCTopicPopupBody");
        iframeEl.setAttribute("src", href);
        iframeEl.setAttribute("name", "MCPopup");

        $containerEl.append(iframeEl);
        $containerEl.appendTo(document.body);

        // check if the popup is set to open at a specific width/height
        var $rootEl = $(this._rootEl);
        var width = $rootEl.attr("data-mc-width");
        var height = $rootEl.attr("data-mc-height");

        if (width != null || height != null) {
            $containerEl.css({
                "top": "50%",
                "left": "50%",
                "width": width,
                "height": height
            });

            // keep it in bounds

            var widthVal = $containerEl.width();
            var heightVal = $containerEl.height();
            var $win = $(window);
            var maxWidth = $win.width() - 100;
            var maxHeight = $win.height() - 100;

            if (widthVal > maxWidth) {
                $containerEl.css({ "width": maxWidth + "px" });
                widthVal = maxWidth;
            }

            if (heightVal > maxHeight) {
                $containerEl.css({ "height": maxHeight + "px" });
                heightVal = maxHeight;
            }

            //

            $containerEl.css({
                "margin-top": (-heightVal / 2) + "px",
                "margin-left": (-widthVal / 2) + "px"
            });
        }

        $(iframeEl).css("height", $containerEl.height());

        // Animate it

        $containerEl.animate(
        {
            opacity: 1
        }, 200);

        // Add the background tint and animate it

        var bgTintEl = TopicHelpers.AddBackgroundTint("dark");

        $(bgTintEl).animate(
        {
            opacity: 0.5
        }, 200);
    };

    TopicHelpers.TopicPopupControl.prototype.Close = function () {
        this.base.Close.call(this);

        var $containerEl = $(".MCTopicPopupContainer");
        $containerEl.remove();

        TopicHelpers.RemoveBackgroundTint();
    };

    //

    TopicHelpers.CreateLinkListTree = function (linkList, parentEl, aEl, prefix, onClick) {

        // Close all other link list popups first
        TopicHelpers.RemoveLinkListTrees();

        if (!prefix)
            prefix = '';

        var $listContainerEl = $("<ul class='responsive-link-list tree inner'></ul>");
        var target = $(aEl).attr("target");

        for (var i = 0, length = linkList.length; i < length; i++) {
            var currLink = linkList[i];
            var $li = $("<li class='IndexEntry IndexEntryLink tree-node tree-node-leaf'></li>").appendTo($listContainerEl);
            var $div = $("<div class='IndexTerm'></div>").appendTo($li);
            var $span = $("<span class='label'></span>").appendTo($div);
            var $a = $("<a/>").appendTo($span);

            $a.text(currLink.Title);

            var link = currLink.Link;

            $a.attr("href", prefix + link);

            $li.click(onClick);
        }

        $listContainerEl.appendTo(parentEl);
    };

    TopicHelpers.CreateLinkListPopup = function (linkList, parentEl, top, left, aEl, prefix) {

        // Close all other link list popups first
        TopicHelpers.RemoveLinkListPopups();

        if (!prefix)
            prefix = '';

        var $listContainerEl = $("<div class='link-list-popup needs-pie'><ul></ul></div>");
        var $listEl = $listContainerEl.children("ul");

        var target = $(aEl).attr("target");

        for (var i = 0, length = linkList.length; i < length; i++) {
            var currLink = linkList[i];
            var $li = $("<li><a></a></li>").appendTo($listEl);
            var $a = $("a", $li);
            $a.attr("target", target);

            if (target == "_popup")
                $a.click(MadCap.TopicHelpers.TopicPopup_Click);

            $a.text(currLink.Title);

            var link = currLink.Link;

            $a.attr("href", prefix + link);

            $li.click(TopicHelpers.Item_Click);
        }

        $listContainerEl.appendTo(parentEl);

        // keep the popup in bounds
        var $scrollParent = $listContainerEl.closest(".popup-container");

        if ($scrollParent.length == 0) // When opening help control popups in Chrome and the document isn't scrollable, the :scrollable plugin was returning null so handle that.
            $scrollParent = $(window);

        var outerWidth = $scrollParent.width();
        var outerHeight = $scrollParent.height();
        var scrollTop = $scrollParent.scrollTop();
        var scrollLeft = $scrollParent.scrollLeft();
        var popupWidth = $listContainerEl[0].offsetWidth;
        var popupHeight = $listContainerEl[0].offsetHeight;
        top = Math.min(top, scrollTop + outerHeight - popupHeight);
        top = Math.max(top, scrollTop);
        left = Math.min(left, scrollLeft + outerWidth - popupWidth);
        left = Math.max(left, scrollLeft);

        // handle keydown case
        if (top == 0 && left == 0) {
            left = $(aEl).offset().left + $(aEl).width();
            top = $(aEl).offset().top + $(aEl).height();;
        }

        $listContainerEl.css("top", top);
        $listContainerEl.css("left", left);

        $listContainerEl.hide().fadeIn(200);

        $([document, aEl]).click(function (e) {
            $listContainerEl.remove();

            $([document, aEl]).off("click", arguments.callee);
        });

        $([document, aEl]).keydown(function (e) {
            var e = e || windows.event;

            if (e.keyCode != 27 && e.keyCode != 13)
                return;

            if (!$listContainerEl.is(':focus'))
                return;

            $listContainerEl.remove();

            $([document, aEl]).off("keydown", arguments.callee);
        });

        $listContainerEl.attr("tabindex", 0);
        $listContainerEl.focus();
    };

    TopicHelpers.Item_Click = function (e) {
        var $a = $('a', this);
        var href = $a.attr('href');
        var frame = $a.attr('target');

        if (href && !MadCap.String.IsNullOrEmpty(href)) {
            if (frame)
                window.open(href, frame);
            else
                document.location.href = href;
        }

        MadCap.Utilities.PreventDefault(e);
    };

    TopicHelpers.RemoveLinkListTrees = function () {
        $(".responsive-link-list").remove();
    }
    TopicHelpers.RemoveLinkListPopups = function () {
        $(".link-list-popup").remove();
    };

    TopicHelpers.AddBackgroundTint = function (type) {
        var $bgTintEl = $("<div id='mc-background-tint'></div>");
        $bgTintEl.addClass(type);
        $bgTintEl.appendTo(document.body);

        return $bgTintEl[0];
    };

    TopicHelpers.RemoveBackgroundTint = function () {
        $("#mc-background-tint").remove();
    };
})();
