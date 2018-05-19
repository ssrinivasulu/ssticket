/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapXhr.js" />
/// <reference path="MadCapHelpSystem.js" />

/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
*
* v10.0.0.0
*/

(function () {
    if (MadCap.Dom.Dataset(document.documentElement, "mcRuntimeFileType") != "Default")
        return;

    MadCap.WebHelp = MadCap.CreateNamespace("WebHelp");

    var previewMode = window.external && window.external.attached && window.external.attached(); // Previewing style changes in the skin editor

    MadCap.WebHelp.TocPane = function (runtimeFileType, helpSystem, containerEl) {
        var mSelf = this;
        this._Init = false;
        this._RuntimeFileType = runtimeFileType;
        this._HtmlNodeID = runtimeFileType == "Toc" ? "toc" : "browseSequences";
        this._ContainerEl = containerEl;
        this._HelpSystem = helpSystem;
        this._TocFile = this._RuntimeFileType == "Toc" ? this._HelpSystem.GetTocFile() : this._HelpSystem.GetBrowseSequenceFile();
        this._LoadedNodes = [];
        var gTocPath = null;
        var gTocHref = null;

        MadCap.Utilities.CrossFrame.AddMessageHandler(this.OnMessage, this);

        this._Initializing = false;
        this._InitOnCompleteFuncs = new Array();

        this.TreeNode_Click = function (e) {
            var target = e.target;

            var liEl = $(target).closest("li")[0];

            if (liEl == null)
                return;

            var $liEl = $(liEl);
            var isTreeNodeLeaf = $liEl.hasClass("tree-node-leaf");

            if (!isTreeNodeLeaf)
                $liEl.toggleClass("tree-node-expanded").toggleClass("tree-node-collapsed");

            var $imgEl = $liEl.find("> div img");
            var alt2 = $imgEl.attr("data-mc-alt2");
            var alt = $imgEl.attr("alt");

            if (alt2 != "") {
                $imgEl.attr("alt", alt2);
                $imgEl.attr("data-mc-alt2", alt);
            }

            var $aEl = $liEl.find("> div a");

            if ($aEl[0] != null) {
                var href = $aEl.attr("href");

                if (!MadCap.String.IsNullOrEmpty(href))
                    mSelf._SelectNode(liEl);

                // if the click didn't occur on the <a> itself, handle it ourselves
                if ($aEl[0] != target) {
                    var frameName = $aEl.attr("target");

                    if (!MadCap.String.IsNullOrEmpty(href)) {
                        if (frameName != null)
                            window.open(href, frameName);
                        else
                            document.location.href = href;
                    }
                }
            }

            var node = mSelf._LoadedNodes[$liEl.attr('data-mc-id')];

            if (!node.childrenLoaded) {
                var $ul = $('<ul/>');
                $ul.addClass('tree inner');
                if (previewMode) {
                    $ul.attr('data-mc-style', "Navigation Panel Item");
                }

                mSelf.LoadTocChildren(node, $ul, function () {
                    $liEl.append($ul);
                });
            }

            // forces the content body to slide over thereby "navigating" to the selected topic
            // caveat: only works for tree node leafs
            if (isTreeNodeLeaf) {
                $('body').removeClass('active');
            }
        };
    };

    var TocPane = MadCap.WebHelp.TocPane;

    TocPane.prototype.OnMessage = function (message, dataValues, responseData) {
        var returnData = { Handled: false, FireResponse: true };

        if (message == "sync-toc") {
            var tocType = dataValues[0];
            var tocPath = dataValues[1];
            var href = new MadCap.Utilities.Url(dataValues[2]);

            if (tocType == null || tocType == this._RuntimeFileType) {
                this.SyncTOC(tocPath, href);
                returnData.Handled = true;
            }
        }

        return returnData;
    };

    TocPane.prototype.Init = function (OnCompleteFunc) {
        if (this._Init) {
            if (OnCompleteFunc != null)
                OnCompleteFunc();

            return;
        }

        if (OnCompleteFunc != null)
            this._InitOnCompleteFuncs.push(OnCompleteFunc);

        if (this._Initializing)
            return;

        this._Initializing = true;

        //

        var $containerEl = $(this._ContainerEl);

        $containerEl.click(this.TreeNode_Click);

        var mSelf = this;

        $containerEl.attr("data-mc-chunk", "Data/" + this._RuntimeFileType + ".xml");

        this.CreateToc(this._ContainerEl, function () {
            mSelf._Init = true;

            for (var i = 0; i < mSelf._InitOnCompleteFuncs.length; i++) {
                mSelf._InitOnCompleteFuncs[i]();
            }
        });
    };

    TocPane.prototype.CreateToc = function (containerEl, OnCompleteFunc) {
        var hasToc = true;

        if (this._RuntimeFileType == "Toc")
            hasToc = this._HelpSystem.HasToc;
        else
            hasToc = this._HelpSystem.HasBrowseSequences;

        if (!hasToc) {
            if (OnCompleteFunc != null)
                OnCompleteFunc();

            return;
        }

        var self = this;

        self._HelpSystem.LoadToc(this._RuntimeFileType, function (toc, args) {
            var $ul = $('<ul/>');
            $ul.addClass('tree');
            if (previewMode) {
                $ul.attr('data-mc-style', "Navigation Panel Item");
            }

            self.LoadTocChildren(toc.tree, $ul, function () {
                var $container = $(self._ContainerEl);
                $container.append($ul);

                this._Init = true;

                if (OnCompleteFunc != null)
                    OnCompleteFunc();
            });
        }, null);
    };

    TocPane.prototype.LoadTocChildren = function (node, el, OnCompleteFunc) {
        var length = typeof node.n !== 'undefined' ? node.n.length : 0; // n property holds child nodes
        var loaded = 0;

        if (length == 0) {
            node.childrenLoaded = true;
        }

        if (node.childrenLoaded) {
            if (OnCompleteFunc)
                OnCompleteFunc();

            return;
        }

        // Create elements
        for (var i = 0; i < length; i++) {
            var childNode = node.n[i];

            var $li = $('<li/>');
            $li.addClass('tree-node tree-node-collapsed');

            el.append($li);

            this.LoadTocNode(childNode, $li, function () {
                loaded++;

                if (loaded == length) {
                    node.childrenLoaded = true;

                    if (OnCompleteFunc != null)
                        OnCompleteFunc();
                }
            });
        }
    }

    TocPane.prototype.LoadTocNode = function (node, el, OnCompleteFunc) {
        var self = this;
        var toc = node.toc;

        this._HelpSystem.LoadTocChunk(toc, node.c, function (chunk) {
            var $div = $('<div/>');

            var addedNewIndicator = false;
            if (typeof node.w !== 'undefined' && node.w == 1) { // mark as new
                $div.append("<span class='new-indicator'></span>");
                addedNewIndicator = true;
            }

            var $span = $('<span class="label" />');

            var entry = toc.entries[node.i];
            var hasFrame = typeof node.f != 'undefined';
            var href = self._HelpSystem.GetTocEntryHref(node, hasFrame ? null : self._RuntimeFileType);

            var $a = $('<a/>');

            if (hasFrame) {
                $a.attr('target', node.f);
            }
            if (href != null) {
                $a.attr('href', href);
            }
            else {
                $a.attr('href', 'javascript:void(0);');
            }
            $a.text(entry.title);

            if (typeof node.s != 'undefined') { // class
                el.addClass(node.s);
            }

            if (typeof node.n == 'undefined' || node.n.length == 0) { // leaf
                el.removeClass('tree-node-collapsed');
                el.addClass("tree-node-leaf");
            }

            // create transparent image
            var customClass = "default";
            var language = self._HelpSystem.Language;

            // check li for custom class
            for (className in language) {
                if (el.hasClass(className)) {
                    customClass = className;
                    break;
                }
            }

            var $img = $('<img/>');
            $img.attr('src', 'Skins/Default/Stylesheets/Images/transparent.gif');
            $img.addClass('toc-icon');

            if (addedNewIndicator) {
                $img.attr('alt', language[customClass]['MarkAsNewIconAlternateText']);
            }
            else if (el.hasClass("tree-node-leaf")) {
                $img.attr('alt', language[customClass]['TopicIconAlternateText']);
            }
            else {
                $img.attr('alt', language[customClass]['ClosedBookIconAlternateText']);
                $img.attr('data-mc-alt2', language[customClass]['OpenBookIconAlternateText']);
            }
            if ($img.prop('src') != "") {
                $a.prepend($img);
            }

            $span.append($a);

            $div.append($span);

            node.el = el;

            el.append($div);
            el.attr('data-mc-id', self._LoadedNodes.length);

            self._LoadedNodes.push(node);

            if (OnCompleteFunc != null)
                OnCompleteFunc();
        });
    };

    TocPane.prototype.SyncTOC = function (tocPath, href) {
        var self = this;

        var selected = $(".tree-node-selected a", this._ContainerEl);

        if (selected.length > 0) {
            var link = selected[0];
            if (link.href === document.location.href)
                return;
        }

        this.Init(function () {
            function OnFoundNode(node) {
                if (typeof node !== 'undefined' && node != null) {
                    var loadNodes = [];
                    var loadNode = node;

                    while (typeof loadNode !== 'undefined' && !loadNode.childrenLoaded) {
                        loadNodes.unshift(loadNode);
                        loadNode = loadNode.parent;
                    }

                    MadCap.Utilities.AsyncForeach(loadNodes,
                            function (loadNode, callback) {
                                var $el = $(loadNode.el);

                                var $ul = $('<ul/>');
                                $ul.addClass('tree inner');

                                self.LoadTocChildren(loadNode, $ul, function () {
                                    $el.append($ul);
                                    callback();
                                });
                            },
                            function () {
                                var el = node.el[0];
                                self._UnhideNode(el);
                                self._SelectNode(el);
                            }
                        );
                }
            }

            function FindNode(href) {
                self._HelpSystem.FindNode(self._RuntimeFileType, tocPath, href, function (node) {
                    if (!node) { // if we don't find a node, try looking for plain path
                        if (!MadCap.String.IsNullOrEmpty(href.Fragment) || !MadCap.String.IsNullOrEmpty(href.Query)) {
                            var url = new MadCap.Utilities.Url(href.PlainPath);
                            self._HelpSystem.FindNode(self._RuntimeFileType, tocPath, url, OnFoundNode);
                        }
                    }
                    else {
                        OnFoundNode(node);
                    }
                });
            }

            var cshid = href.HashMap.GetItem('cshid');

            if (cshid != null) {
                self._HelpSystem.LookupCSHID(cshid, function (idInfo) {
                    var url = idInfo.Found ? new MadCap.Utilities.Url(idInfo.Topic).ToRelative(self._HelpSystem.GetContentPath()) 
                                           : new MadCap.Utilities.Url(self._HelpSystem.DefaultStartTopic);
                    FindNode(url);
                });
            }
            else {
                FindNode(href);
            }
        });
    };

    TocPane.prototype._UnhideNode = function (tocNode) {
        var parentTocNode = MadCap.Dom.GetAncestorNodeByTagName(tocNode, "li", this._ContainerEl);

        while (parentTocNode != null) {
            var $parentTocNode = $(parentTocNode);
            $parentTocNode.removeClass("tree-node-collapsed");
            $parentTocNode.addClass("tree-node-expanded");

            parentTocNode = MadCap.Dom.GetAncestorNodeByTagName(parentTocNode, "li", this._ContainerEl);
        }
    };

    TocPane.prototype.NavigateTopic = function (moveType) {
        var selectedNode = $(".tree-node-selected", this._ContainerEl)[0];

        if (selectedNode == null)
            selectedNode = $(".tree-node", this._ContainerEl)[0];

        //

        if (this.NeedsCreateToc(selectedNode)) {
            var mSelf = this;

            this.CreateToc(selectedNode, function () {
                mSelf.NavigateTopic(moveType);
            });

            return;
        }

        //

        var nextNode = moveType == "previous" ? this._GetPrevious(selectedNode) : this._GetNext(selectedNode);

        if (nextNode == null)
            return;

        this._SelectNode(nextNode);

        var a = $("> div a", nextNode)[0];

        if (a != null)
            document.location.href = $(a).attr("href");

        this._UnhideNode(nextNode);
    };

    TocPane.prototype._SelectNode = function (node) {
        var $node = $(node);

        $(".tree-node-selected", this._ContainerEl).removeClass("tree-node-selected");
        $node.addClass("tree-node-selected");
        $node.scrollintoview();
    };

    TocPane.prototype._GetNext = function (node) {
        var $node = $(node);

        if ($node.find(".tree-node").length > 0)
            return $node.find(".tree-node")[0];

        if ($node.next(".tree-node").length > 0)
            return $node.next(".tree-node")[0];

        var $currAnc = $node;

        while (true) {
            var $anc = $($currAnc.parent().closest(".tree-node", this._ContainerEl));

            if ($anc.length == 0)
                break;

            if ($anc.next(".tree-node").length > 0)
                return $anc.next(".tree-node")[0];

            $currAnc = $anc;
        }

        return null;
    };

    TocPane.prototype._GetPrevious = function (node) {
        var $node = $(node);

        var $prev = $node.prev(".tree-node");

        if ($prev.length == 0) {
            if ($node.parent().closest(".tree-node", this._ContainerEl).length > 0)
                return $node.parent().closest(".tree-node", this._ContainerEl)[0];
            else
                return null;
        }

        if ($prev.find(".tree-node").length > 0)
            return $prev.find(".tree-node").last()[0];

        return $prev[0];
    };
})();
