/// <reference path="../../Scripts/jquery.js" />
/// <reference path="../../Scripts/require.js" />
/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapXhr.js" />

/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
*
* v10.0.0.0
*/

MadCap.WebHelp = MadCap.CreateNamespace("WebHelp");

//
//    Class HelpSystem
//

MadCap.WebHelp.HelpSystem = function (parentSubsystem, parentPath, xmlFile, tocPath, browseSequencePath) {
    // Private member variables

    var mSelf = this;
    var mParentSubsystem = parentSubsystem;
    var mPath = new MadCap.Utilities.Url(xmlFile).ToFolder().ToFolder().FullPath;
    var mAbsolutePath = null;
    var mSubsystems = new Array();
    var mTocPath = tocPath;
    var mBrowseSequencePath = browseSequencePath;
    var mFilterMap = null;
    var mIndexLinkMap = new MadCap.Utilities.Dictionary();
    var mConceptMap = null;
    var mViewedConceptMap = new MadCap.Utilities.Dictionary();
    var mExists = false;
    var mAliasFile = new MadCap.WebHelp.AliasFile(mPath + "Data/Alias.xml", this);
    var mTocFile = new MadCap.WebHelp.TocFile(this, MadCap.WebHelp.TocFile.TocType.Toc);
    var mIndexXmlDoc = null;
    var mBrowseSequenceFile = new MadCap.WebHelp.TocFile(this, MadCap.WebHelp.TocFile.TocType.BrowseSequence);
    var mSkinMap = new MadCap.Utilities.Dictionary();

    // Public properties

    this.TargetType = null;
    this.DefaultStartTopic = null;
    this.InPreviewMode = null;
    this.LiveHelpOutputId = null;
    this.LiveHelpServer = null;
    this.LiveHelpEnabled = false;
    this.IsWebHelpPlus = false;
    this.ContentFolder = null;
    this.UseCustomTopicFileExtension = false;
    this.CustomTopicFileExtension = null;
    this.GlossaryUrl = null;
    this.SearchFilterSetUrl = null;
    this.SyncTOC = null;
    this.DefaultSkin = null;
    this.IsAutoMerged = false;
    this.LanguageUrl = null;
    this.BreakpointsUrl = null;
    this.IsResponsive = false;

    // Constructor

    (function () {
    })();

    // Public functions

    this.Load = function (OnCompleteFunc) {
        MadCap.Utilities.Xhr.Load(xmlFile, true, function (xmlDoc) {
            var loaded = 0;

            function OnLoadSubHelpSystemComplete() {
                loaded++;

                if (loaded == mSubsystems.length)
                    OnCompleteFunc();
            }

            function LoadSubsystems(OnLoadSubHelpSystemComplete, OnCompleteFunc) {
                if (mSubsystems.length > 0) {
                    for (var i = 0; i < mSubsystems.length; i++) {
                        mSubsystems[i].Load(OnLoadSubHelpSystemComplete);
                    }
                }
                else {
                    OnCompleteFunc();
                }
            }

            mExists = xmlDoc != null;

            if (!mExists) {
                OnCompleteFunc();
                return;
            }

            this.TargetType = xmlDoc.documentElement.getAttribute("TargetType");
            this.DefaultStartTopic = xmlDoc.documentElement.getAttribute("DefaultUrl");
            this.InPreviewMode = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "InPreviewMode", false);
            this.LiveHelpOutputId = xmlDoc.documentElement.getAttribute("LiveHelpOutputId");
            this.LiveHelpServer = xmlDoc.documentElement.getAttribute("LiveHelpServer");
            this.LiveHelpEnabled = this.LiveHelpOutputId != null;
            this.MoveContentToRoot = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "MoveOutputContentToRoot", false);

            var serverEnabled = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "ServerEnabled", false);
            this.IsWebHelpPlus = (this.TargetType == "WebHelpPlus" || serverEnabled) && MadCap.String.StartsWith(document.location.protocol, "http", false);

            var makeFileLowerCase = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "MakeFileLowerCase", false);
            var contentFolder = "";

            if (!this.MoveContentToRoot)
                contentFolder = "Content/";

            if (makeFileLowerCase)
                contentFolder = contentFolder.toLowerCase();

            this.ContentFolder = contentFolder;
            this.UseCustomTopicFileExtension = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "UseCustomTopicFileExtension", false);
            this.CustomTopicFileExtension = MadCap.Dom.GetAttribute(xmlDoc.documentElement, "CustomTopicFileExtension");

            this.GlossaryUrl = GetDataFileUrl(xmlDoc, "Glossary");
            this.TocUrl = GetDataFileUrl(xmlDoc, "Toc");
            this.BrowseSequencesUrl = GetDataFileUrl(xmlDoc, "BrowseSequence");
            this.IndexUrl = GetDataFileUrl(xmlDoc, "Index");
            this.SearchFilterSetUrl = GetDataFileUrl(xmlDoc, "SearchFilterSet");
            this.LanguageUrl = mPath + "Data/Language.js";
            this.BreakpointsUrl = mPath + "Data/Breakpoints.js";
            this.HasBrowseSequences = xmlDoc.documentElement.getAttribute("BrowseSequence") != null;
            this.HasToc = xmlDoc.documentElement.getAttribute("Toc") != null;

            //

            CacheSkins.call(this, xmlDoc);
            this.DefaultSkin = this.GetSkin($(xmlDoc.documentElement).attr("SkinName"));

            this.IsResponsive = MadCap.String.ToBool(this.DefaultSkin.EnableResponsiveOutput, this.IsResponsive);

            this.SyncTOC = MadCap.String.ToBool(this.DefaultSkin.AutoSyncTOC, false);

            this.DisplayCommunitySearchResults = MadCap.String.ToBool(this.DefaultSkin.DisplayCommunitySearchResults, true);
            this.CommunitySearchResultsCount = MadCap.String.ToInt(this.DefaultSkin.CommunitySearchResultsCount, 3);

            //

            var subsystemsNodes = xmlDoc.getElementsByTagName("Subsystems");

            if (subsystemsNodes.length > 0 && subsystemsNodes[0].getElementsByTagName("Url").length > 0) {
                var urlNodes = xmlDoc.getElementsByTagName("Subsystems")[0].getElementsByTagName("Url");

                for (var i = 0; i < urlNodes.length; i++) {
                    var urlNode = urlNodes[i];
                    if (!urlNode)
                        continue;

                    var url = urlNode.getAttribute("Source");
                    var subPath = url.substring(0, url.lastIndexOf("/") + 1);
                    var tocPath = urlNode.getAttribute("TocPath");
                    var browseSequencePath = urlNode.getAttribute("BrowseSequencePath");

                    var subHelpSystem = new MadCap.WebHelp.HelpSystem(this, mPath + subPath, mPath + subPath + "Data/HelpSystem.xml", tocPath, browseSequencePath);
                    mSubsystems.push(subHelpSystem);
                }
            }

            
            this.LoadBreakpoints(function () {
                mSelf.LoadLanguage(function () {
                    if (!mSelf.IsAutoMerged && mSelf.IsWebHelpPlus) {
                        MadCap.Utilities.Xhr.CallWebService(mSelf.GetPath() + "Service/Service.asmx/GetSubsystems", true, function (xmlDoc, args) {
                            $.each(xmlDoc.documentElement.childNodes, function (i, node) {
                                if (node.nodeName == "Subsystems") {
                                    $.each(node.childNodes, function (i, node) {
                                        if (node.nodeName == "Url") {
                                            var url = node.getAttribute("Source");
                                            var subPath = url.substring(0, url.lastIndexOf("/") + 1);
                                            if (subPath) {
                                                var subHelpSystem = new MadCap.WebHelp.HelpSystem(mSelf, mPath + subPath, mPath + subPath + "Data/HelpSystem.xml", null, null);
                                                subHelpSystem.IsAutoMerged = true;
                                                mSubsystems.push(subHelpSystem);
                                            }
                                        }
                                    });
                                }
                            });

                            LoadSubsystems(OnLoadSubHelpSystemComplete, OnCompleteFunc);
                        });
                    }
                    else {
                        LoadSubsystems(OnLoadSubHelpSystemComplete, OnCompleteFunc);
                    }
                })
            });
        }, null, this);
    };

    this.GetExists = function () {
        return mExists;
    };

    this.GetMasterHelpsystem = function () {
        var master = this;

        for (var curr = master.GetParentSubsystem(); curr != null; curr = curr.GetParentSubsystem()) {
            master = curr;
        }

        return master;
    };

    this.GetParentSubsystem = function () {
        return mParentSubsystem;
    };

    this.GetPath = function () {
        return mPath;
    };

    this.GetAbsolutePath = function () {
        if (mAbsolutePath == null) {
            var url = new MadCap.Utilities.Url(mPath);
            mAbsolutePath = url.IsAbsolute ? url.FullPath : new MadCap.Utilities.Url(document.location.href).Path;
        }

        return mAbsolutePath;
    };

    this.GetContentPath = function () {
        return mPath + this.ContentFolder;
    };

    this.GetSkin = function (name) {
        return mSkinMap.GetItem(name);
    };

    this.GetTocPath = function (tocType) {
        return tocType == "toc" ? mTocPath : mBrowseSequencePath;
    };

    this.GetFullTocPath = function (tocType, href) {
        var subsystem = this.GetHelpSystem(href);

        if (subsystem == null)
            return null;

        var fullTocPath = new Object();

        fullTocPath.tocPath = this.GetTocPath(tocType);
        subsystem.ComputeTocPath(tocType, fullTocPath);

        return fullTocPath.tocPath;
    };

    this.ComputeTocPath = function (tocType, tocPath) {
        if (mParentSubsystem) {
            var hsTocPath = this.GetTocPath(tocType);

            if (!MadCap.String.IsNullOrEmpty(hsTocPath)) {
                tocPath.tocPath = tocPath.tocPath ? hsTocPath + "|" + tocPath.tocPath : hsTocPath;
            }

            mParentSubsystem.ComputeTocPath(tocType, tocPath);
        }
    };

    this.GetHelpSystem = function (path) {
        var helpSystem = null;

        for (var i = 0; i < mSubsystems.length; i++) {
            helpSystem = mSubsystems[i].GetHelpSystem(path);

            if (helpSystem != null) {
                return helpSystem;
            }
        }

        if (MadCap.String.StartsWith(path, mPath, false)) {
            return this;
        }

        return null;
    };

    this.GetSubsystem = function (id) {
        return mSubsystems[id];
    };

    this.GetMergedAliasIDs = function (OnCompleteFunc) {
        mAliasFile.Load(function () {
            function OnGetIDs(ids) {
                for (var i = 0, length2 = ids.length; i < length2; i++) {
                    mergedIDs[mergedIDs.length] = ids[i];
                }

                completed++;

                if (completed == length + 1) {
                    OnCompleteFunc(mergedIDs);
                }
            }

            var mergedIDs = new Array();
            var length = mSubsystems.length;
            var completed = 0;
            var ids = mAliasFile.GetIDs();

            OnGetIDs(ids);

            for (var i = 0; i < length; i++) {
                mSubsystems[i].GetMergedAliasIDs(OnGetIDs);
            }
        });
    };

    this.GetMergedAliasNames = function (OnCompleteFunc) {
        mAliasFile.Load(function () {
            function OnGetNames(names) {
                for (var i = 0, length2 = names.length; i < length2; i++) {
                    mergedNames[mergedNames.length] = names[i];
                }

                completed++;

                if (completed == length + 1) {
                    OnCompleteFunc(mergedNames);
                }
            }

            var mergedNames = new Array();
            var length = mSubsystems.length;
            var completed = 0;
            var names = mAliasFile.GetNames();

            OnGetNames(names);

            for (var i = 0, length = mSubsystems.length; i < length; i++) {
                mSubsystems[i].GetMergedAliasNames(OnGetNames);
            }
        });
    };

    this.LookupCSHID = function (id, OnCompleteFunc) {
        mAliasFile.Load(function () {
            function OnLookupCSHID(idInfo) {
                if (found)
                    return;

                completed++;

                if (idInfo.Found) {
                    found = true;

                    OnCompleteFunc(idInfo);

                    return;
                }

                if (completed == length) {
                    OnCompleteFunc(cshIDInfo);
                }
            }

            var cshIDInfo = mAliasFile.LookupID(id);

            if (cshIDInfo.Found) {
                cshIDInfo.Topic = mSelf.GetPath() + cshIDInfo.Topic;

                OnCompleteFunc(cshIDInfo);

                return;
            }

            if (mSubsystems.length == 0) {
                OnCompleteFunc(cshIDInfo);
                return;
            }

            var found = false;
            var completed = 0;

            for (var i = 0, length = mSubsystems.length; i < length; i++) {
                mSubsystems[i].LookupCSHID(id, OnLookupCSHID);
            }
        });
    };

    this.GetTocFile = function () {
        return mTocFile;
    };

    this.GetBrowseSequenceFile = function () {
        return mBrowseSequenceFile;
    };

    this.IsMerged = function () {
        return (mSubsystems.length > 0);
    };

    this.IsRoot = function () {
        return mParentSubsystem == null;
    };

    this.LoadLanguage = function (onCompleteFunc, loadContextObj) {
        var self = this;

        require([this.LanguageUrl], function (language) {
            self.Language = language;

            onCompleteFunc.call(loadContextObj, language);
        });
    };

    this.LoadBreakpoints = function (onCompleteFunc, loadContextObj) {
        if (this.IsResponsive && this.IsRoot()) {
            var self = this;

            require([this.BreakpointsUrl], function (breakpoints) {
                self.Breakpoints = breakpoints;

                onCompleteFunc.call(loadContextObj, breakpoints);
            });
        }
        else {
            onCompleteFunc.call(loadContextObj, null);
        }
    };

    this.LoadConcepts = function (OnCompleteFunc) {
        if (mConceptMap) {
            OnCompleteFunc();
            return;
        }

        MadCap.Utilities.Xhr.Load(mPath + "Data/Concepts.xml", true, function (xmlDoc) {
            mConceptMap = new MadCap.Utilities.Dictionary();

            var xmlHead = xmlDoc.documentElement;

            for (var i = 0; i < xmlHead.childNodes.length; i++) {
                var entry = xmlHead.childNodes[i];

                if (entry.nodeType != 1) { continue; }

                var term = entry.getAttribute("Term").toLowerCase();
                var links = new Array();

                for (var j = 0; j < entry.childNodes.length; j++) {
                    var link = entry.childNodes[j];

                    if (link.nodeType != 1) { continue; }

                    var title = link.getAttribute("Title");
                    var url = link.getAttribute("Link");

                    url = mPath + ((url.charAt(0) == "/") ? url.substring(1, url.length) : url);

                    links[links.length] = { Title: title, Link: url };
                }

                mConceptMap.Add(term, links);
            }

            OnCompleteFunc();
        }, null, null);
    };

    this.LoadAllConcepts = function (OnCompleteFunc) {
        function OnLoadConceptsComplete() {
            completed++;

            if (completed == length + 1)
                OnCompleteFunc();
        }

        var completed = 0;
        var length = mSubsystems.length;

        this.LoadConcepts(OnLoadConceptsComplete);

        for (var i = 0; i < length; i++) {
            var subsystem = mSubsystems[i];

            if (!subsystem.GetExists()) {
                OnLoadConceptsComplete();
                continue;
            }

            subsystem.LoadConcepts(OnLoadConceptsComplete);
        }
    };

    this.GetConceptsLinks = function (conceptTerms, callbackFunc, callbackArgs) {
        if (this.IsWebHelpPlus) {
            function OnGetTopicsForConceptsComplete(xmlDoc, args) {
                var links = new Array();
                var nodes = xmlDoc.documentElement.getElementsByTagName("Url");
                var nodeLength = nodes.length;

                for (var i = 0; i < nodeLength; i++) {
                    var node = nodes[i];
                    var title = node.getAttribute("Title");
                    var url = node.getAttribute("Source");

                    url = mPath + ((url.charAt(0) == "/") ? url.substring(1, url.length) : url);

                    links[links.length] = { Title: title, Link: url };
                }

                callbackFunc(links, callbackArgs);
            }

            MadCap.Utilities.Xhr.CallWebService(mPath + "Service/Service.asmx/GetTopicsForConcepts?Concepts=" + conceptTerms, true, OnGetTopicsForConceptsComplete);
        }
        else {
            var links = null;

            conceptTerms = conceptTerms.replace("\\;", "%%%%%");

            if (conceptTerms == "") {
                links = new Array();
                callbackFunc(links, callbackArgs);
            }

            var concepts = conceptTerms.split(";");

            this.GetConceptsLinksLocal(concepts, function (links) {
                callbackFunc(links, callbackArgs);
            });
        }
    };

    this.GetConceptsLinksLocal = function (concepts, OnCompleteFunc) {
        function OnGetConceptLinksLocalComplete(currLinks) {
            for (var i = 0; i < currLinks.length; i++) {
                links[links.length] = currLinks[i];
            }

            completed++;

            if (completed == length) {
                OnCompleteFunc(links);
            }
        }

        var completed = 0;
        var length = concepts.length;

        //

        var links = new Array();

        for (var i = 0; i < concepts.length; i++) {
            var concept = concepts[i];

            concept = concept.replace("%%%%%", ";");
            concept = concept.toLowerCase();

            this.GetConceptLinksLocal(concept, OnGetConceptLinksLocalComplete);
        }
    };

    this.GetConceptLinksLocal = function (concept, OnCompleteFunc) {
        this.LoadConcepts(function () {
            function OnGetConceptLinksLocalComplete(subConcepts) {
                MergeConceptLinks(links, subConcepts);

                completed++;

                if (completed == length) {
                    mViewedConceptMap.Add(concept, links);

                    var linksClone = $.extend(true, [], links);

                    OnCompleteFunc(linksClone);
                }
            }

            var links = mViewedConceptMap.GetItem(concept);

            if (links != null) {
                var linksClone = $.extend(true, [], links);

                OnCompleteFunc(linksClone);
                return;
            }

            links = mConceptMap.GetItem(concept);

            if (!links) {
                links = new Array(0);
            }

            var completed = 0;
            var length = 0;

            // Calculate "length" first
            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) { continue; }

                length++;
            }

            if (length == 0) {
                OnCompleteFunc(links);
                return;
            }

            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) { continue; }

                subsystem.GetConceptLinksLocal(concept, OnGetConceptLinksLocalComplete);
            }
        });
    };

    this.LoadToc = function (type, onCompleteFunc, loadContextObj) {
        var self = this;
        var toc = self[type];

        if (typeof toc !== 'undefined') {
            onCompleteFunc.call(loadContextObj, toc);
        }
        else {
            this.GetToc(type, function (toc) {
                onCompleteFunc.call(loadContextObj, toc);
            });
        }
    }

    this.GetToc = function (type, OnCompleteFunc) {
        var self = this;
        var url = this[type + "Url"];

        require([url], function (toc) {
            if (typeof toc == 'undefined') {
                OnCompleteFunc(toc);
                return;
            }

            self[type] = toc;

            toc.type = type;
            toc.helpSystem = self;

            // Create chunks array
            toc.chunks = [];
            toc.entries = [];
            toc.nodes = {};
            var dataPath = new MadCap.Utilities.Url(url).ToFolder();

            for (var c = 0; c < toc.numchunks; c++) {
                toc.chunks[c] = {
                    path: dataPath.AddFile(toc.prefix + c + '.js').FullPath,
                    loaded: false
                };
            }

            // Traverse toc nodes and set relationships, store nodes to merge
            var node = toc.tree;
            var merge = {};
            toc.automerge = toc.tree;

            while (node != null) {
                node.toc = toc;
                node.childrenLoaded = false;

                toc.nodes[node.i] = node;

                if (typeof node.m !== 'undefined') {
                    merge[node.m] = node;
                }

                if (typeof node.a !== 'undefined') {
                    toc.automerge = node;
                }

                if (typeof node.n !== 'undefined') {
                    for (var i = 0; i < node.n.length; i++) {
                        node.n[i].parent = node; // parent
                        if (i < node.n.length - 1)
                            node.n[i].next = node.n[i + 1]; // next sibling
                        if (i > 0)
                            node.n[i].previous = node.n[i - 1]; // previous sibling
                    }
                }

                node = GetNextNode(node);
            }

            // If we have no subsystems, return
            var mergeSystems = [];
            var hasAutoMergeSystems = false;

            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (subsystem.GetExists()) {
                    if (!subsystem.IsAutoMerged)
                        subsystem.MergeNode = merge[i];
                    else
                        hasAutoMergeSystems = true;

                    if (subsystem.IsAutoMerged || typeof subsystem.MergeNode !== 'undefined')
                        mergeSystems.push(subsystem);
                }
                else {
                    RemoveNode(merge[i]);
                }
            }

            if (!hasAutoMergeSystems && toc.automerge.a == 'replace')
                RemoveNode(toc.automerge);

            if (mergeSystems.length == 0) {
                OnCompleteFunc(toc);
                return;
            }

            // Merge tocs
            MadCap.Utilities.AsyncForeach(mergeSystems, function (system, callback) {
                MergeTocs(toc, system, callback);
            }, function () {
                OnCompleteFunc(toc);
            });
        });
    };

    function RemoveNode(node) {
        var parent = node.parent;
        var previous = node.previous;
        var next = node.next;

        if (previous) {
            previous.next = next;
            node.previous = null;
        }
        if (next) {
            next.previous = previous;
            node.next = null;
        }
        if (parent) {
            var i = node.parent.n.indexOf(node);
            parent.n.splice(i, 1);
            node.parent = null;
        }
    }

    function GetNextNode(node) {
        var next = null;

        if (typeof node.n != 'undefined') {
            next = node.n[0]; // first child
        }
        else if (typeof node.next != 'undefined') {
            next = node.next;
        }
        else {
            next = node;

            while (typeof next.parent != 'undefined') {
                if (typeof next.parent.next != 'undefined') {
                    next = next.parent.next;
                    break;
                }
                else {
                    next = next.parent;
                }
            }

            if (typeof next.parent == 'undefined') { // reached root
                next = null;
            }
        }

        return next;
    }

    function GetPreviousNode(node) {
        var previous = null;

        if (typeof node.previous != 'undefined') {
            previous = node.previous;

            while (typeof previous.n !== 'undefined' && previous.n.length > 0) {
                previous = previous.n[previous.n.length - 1];
            }
        }
        else if (typeof node.parent != 'undefined') {
            previous = node.parent;
        }

        return previous;
    }

    function GetTocPath(node, encode) {
        var tocPath = "";
        var linkNodeIndex = -1;
        var childNode = null;

        if (node.n && node.n.length > 0) {
            tocPath = node.toc.entries[node.i].title;
            if (encode)
                tocPath = encodeURIComponent(tocPath);

            linkNodeIndex = 0;
        }
        else {
            linkNodeIndex = node.parent.n.indexOf(node) + 1;
        }

        if (tocPath.length > 0)
            tocPath += "|";

        tocPath += ("_____" + linkNodeIndex);

        for (var currNode = node.parent; currNode && typeof currNode.i !== 'undefined'; currNode = currNode.parent) {
            if (tocPath == null)
                tocPath = "";

            if (tocPath.length > 0)
                tocPath = "|" + tocPath;

            var tocTitle = currNode.toc.entries[currNode.i].title;
            if (encode)
                tocTitle = encodeURIComponent(tocTitle);
            tocPath = tocTitle + tocPath;
        }

        return tocPath;
    }

    function MergeTocs(toc1, subsystem, OnCompleteFunc) {
        subsystem.GetToc(toc1.type, function (toc2) {
            if (typeof toc2 == 'undefined') {
                OnCompleteFunc();
                return;
            }

            var node = subsystem.IsAutoMerged ? toc1.automerge : subsystem.MergeNode;
            var newNode = toc2.tree;

            if (typeof newNode.n !== 'undefined') {
                var replace = node.r == 1 || (subsystem.IsAutoMerged && node.a == 'replace');
                var insertBefore = replace || (subsystem.IsAutoMerged && (node.a == 'before-head' || node.a == 'after-head'));
                var insertSibling = replace || (subsystem.IsAutoMerged && (node.a == 'before-head' || node.a == 'after-tail'));
                var parent = insertSibling ? node.parent : node;

                if (typeof parent.n == 'undefined') {
                    parent.n = [];
                }

                var childIndex = insertSibling ? parent.n.indexOf(node) + (insertBefore ? 0 : 1)
                                               : insertBefore ? 0 : parent.n.length;
                var length = newNode.n.length;

                for (var i = 0; i < length; i++) {
                    newNode.n[i].parent = parent;
                    parent.n.splice(childIndex + i, 0, newNode.n[i]);
                }

                if (replace) {
                    parent.n.splice(childIndex + length, 1);
                }

                if (childIndex > 0) {
                    parent.n[childIndex].previous = parent.n[childIndex - 1];
                    parent.n[childIndex - 1].next = parent.n[childIndex];
                }

                var lastChildIndex = childIndex + length - (replace ? 1 : 0) - 1;
                if (lastChildIndex >= 0 && lastChildIndex + 1 < parent.n.length) {
                    parent.n[lastChildIndex].next = parent.n[lastChildIndex + 1];
                    parent.n[lastChildIndex + 1].previous = parent.n[lastChildIndex];
                }

                if (subsystem.IsAutoMerged) {
                    toc1.automerge = parent.n[childIndex + length - 1];
                    toc1.automerge.a = 'after-tail';
                }
            }

            OnCompleteFunc();
        });
    }

    this.LoadTocChunk = function (toc, chunkIndex, onCompleteFunc) {
        require([toc.chunks[chunkIndex].path], function (chunk) {
            // load entries from chunk if not loaded already
            if (!toc.chunks[chunkIndex].loaded) {
                for (var link in chunk) {
                    for (var i = 0; i < chunk[link].i.length; i++) {
                        toc.entries[chunk[link].i[i]] = {
                            link: link,
                            title: chunk[link].t[i],
                            bookmark: chunk[link].b[i]
                        };
                    }
                }

                toc.chunks[chunkIndex].loaded = true;
            }

            if (onCompleteFunc)
                onCompleteFunc(chunk);
        });
    }

    this.GetTocEntryHref = function (entry, tocType) {
        var toc = entry.toc;
        var e = toc.entries[entry.i];
        var link = e.link + e.bookmark;
        var href = null;

        if (typeof entry.m == 'undefined' && link != '___') { // '___' is a placeholder for no href
            var url = null;
            var linkUrl = new MadCap.Utilities.Url(link);
            var helpSystem = toc.helpSystem;
            var helpSystemPath = helpSystem.GetPath();
            var root = helpSystem.GetMasterHelpsystem().GetContentPath();

            if (!linkUrl.IsAbsolute) {
                if (!MadCap.String.IsNullOrEmpty(helpSystemPath)) {
                    var linkUrl = new MadCap.Utilities.Url(helpSystemPath).CombinePath(link);

                    url = linkUrl.ToRelative(root);
                }
                else {
                    url = linkUrl.ToRelative("/" + root);
                }
            }
            else {
                url = linkUrl;
            }

            if (typeof entry.f != 'undefined') { // frame
                if (url.IsAbsolute)
                    href = url.FullPath;
                else
                    href = root + url.FullPath;
            }
            else {
                href = "#" + url.FullPath;
            }
        }

        if (href != null && tocType) {
            var tocPath = GetTocPath(entry, true);
            href += encodeURIComponent('?' + tocType + 'Path=' + tocPath);
        }

        return href;
    }

    this.FindTocNode = function (title, href, onCompleteFunc) {
        mSelf.FindNode("Toc", title, href, onCompleteFunc);
    }

    this.FindBrowseSequenceNode = function (title, href, onCompleteFunc) {
        mSelf.FindNode("BrowseSequences", title, href, onCompleteFunc);
    }

    this.FindNode = function (tocType, tocPath, href, onCompleteFunc) {
        mSelf.LoadToc(tocType, function (toc) {
            var root = new MadCap.Utilities.Url(mSelf.GetMasterHelpsystem().GetContentPath());
            var url = href;
            var chunkIndex = 0;
            var foundNode;

            if (!href.IsAbsolute) {
                var url = !MadCap.String.IsNullOrEmpty(root.FullPath) ? root.CombinePath(href) : href;
                url = url.ToRelative(mSelf.GetPath());

                url = new MadCap.Utilities.Url('/' + url.FullPath);
            }

            // find chunk
            for (var i = 1; i < toc.chunkstart.length; i++) {
                if (toc.chunkstart[i] <= url.PlainPath)
                    chunkIndex++;
            }

            mSelf.LoadTocChunk(toc, chunkIndex, function (chunk) {
                var entry = chunk[url.PlainPath];

                if (typeof entry !== 'undefined') {
                    var id = null;

                    if (!foundNode)
                        foundNode = toc.nodes[entry.i[0]];

                    if (tocPath) {
                        for (var i = 0; i < entry.i.length; i++) {
                            if (GetTocPath(toc.nodes[entry.i[i]], false) == tocPath) {
                                id = entry.i[i];
                                break;
                            }
                        }
                    }
                    else {
                        for (var i = 0; i < entry.i.length; i++) {
                            if (entry.b[i].toLowerCase() == url.Fragment.toLowerCase()) {
                                id = entry.i[i];
                                break;
                            }
                        }
                    }

                    if (id != null) {
                        onCompleteFunc(toc.nodes[id]);
                        return;
                    }
                }

                if (mSubsystems.length > 0) {
                    MadCap.Utilities.AsyncForeach(mSubsystems,
                        function (subSystem, callback) {
                            subSystem.FindNode(tocType, tocPath, href, function (node) {
                                if (typeof node !== 'undefined') {
                                    onCompleteFunc(node);
                                    return;
                                }
                                callback();
                            });
                        },
                        function () {
                            onCompleteFunc(foundNode);
                        }
                    );
                }
                else {
                    onCompleteFunc(foundNode);
                }
            });
        });
    }

    this.LoadGlossary = function (onCompleteFunc, loadContextObj) {
        var self = this;

        this.GetGlossary(function (glossary) {
            self.Glossary = glossary;

            onCompleteFunc.call(loadContextObj, glossary);
        });
    }

    this.GetGlossary = function (OnCompleteFunc) {
        require([this.GlossaryUrl], function (glossary) {
            function OnMergeGlossariesComplete() {
                completed++;

                if (completed == length) {
                    OnCompleteFunc(glossary);
                }
            }

            if (typeof glossary == 'undefined') {
                OnCompleteFunc(glossary);
                return;
            }

            var completed = 0;
            var length = 0;

            // Create chunks array
            glossary.chunks = [];
            var dataPath = new MadCap.Utilities.Url(mSelf.GlossaryUrl).ToFolder();
            for (var c = 0; c < glossary.numchunks; c++) {
                glossary.chunks.push(dataPath.AddFile(glossary.prefix + c + '.js').FullPath);
            }

            // Calculate "length" first
            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) { continue; }

                length++;
            }

            if (length == 0) {
                OnCompleteFunc(glossary);
                return;
            }

            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) {
                    continue;
                }

                MergeGlossaries(glossary, subsystem, OnMergeGlossariesComplete);
            }
        });
    };

    this.LoadIndex = function (onCompleteFunc, loadContextObj) {
        if (typeof this.Index !== 'undefined') {
            onCompleteFunc.call(loadContextObj, this.Index);
            return;
        }

        var self = this;

        this.GetIndex(function (index) {
            self.Index = index;

            onCompleteFunc.call(loadContextObj, index);
        });
    }

    this.GetIndex = function (OnCompleteFunc) {
        require([this.IndexUrl], function (index) {
            function OnMergeIndexesComplete() {
                completed++;

                if (completed == length) {
                    OnCompleteFunc(index);
                }
            }

            if (typeof index == 'undefined') {
                OnCompleteFunc(index);
                return;
            }

            var completed = 0;
            var length = 0;

            // Create chunks array
            index.chunks = [];
            var dataPath = new MadCap.Utilities.Url(mSelf.IndexUrl).ToFolder().ToRelative(document.location.href);
            for (var c = 0; c < index.numchunks; c++) {
                index.chunks.push(dataPath.AddFile(index.prefix + c + '.js').FullPath);
            }

            // Calculate "length" first
            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) { continue; }

                length++;
            }

            if (length == 0) {
                OnCompleteFunc(index);
                return;
            }

            for (var i = 0; i < mSubsystems.length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) {
                    continue;
                }

                MergeIndexes(index, subsystem, OnMergeIndexesComplete);
            }
        });
    };

    this.LoadRootIndexEntry = function (rootEntry, onCompleteFunc) {
        if (rootEntry.loaded) {
            if (onCompleteFunc)
                onCompleteFunc(rootEntry);
            return;
        }

        this.LoadIndex(function (index) {
            var chunks = typeof rootEntry.c == 'number' ? [rootEntry.c] : rootEntry.c;

            MadCap.Utilities.AsyncForeach(chunks, function (c, callback) {
                var chunkPath = index.chunks[c];

                // Load chunk
                require([chunkPath], function (chunk) {
                    var entry = chunk[rootEntry.t];

                    var helpSystemRoot = new MadCap.Utilities.Url(chunkPath).ToFolder().ToFolder().FullPath;
                    if (MadCap.String.EndsWith(helpSystemRoot, "/"))
                        helpSystemRoot = helpSystemRoot.slice(0, -1);

                    mSelf.SetIndexEntryRoot(entry, helpSystemRoot);
                    mSelf.MergeIndexEntries(rootEntry, entry);

                    callback();
                });
            },
            function () {
                mSelf.LoadIndexEntry(rootEntry);

                if (onCompleteFunc)
                    onCompleteFunc(rootEntry);
            });
        });
    }

    this.SetIndexEntryRoot = function (entry, helpSystemRoot) {
        if (entry.l) {
            $.each(entry.l, function (index, link) {
                link.root = helpSystemRoot;
            });
        }

        if (entry.e) {
            $.each(entry.e, function (term, entry) {
                mSelf.SetIndexEntryRoot(entry, helpSystemRoot);
            });
        }
    }

    this.LoadIndexEntry = function (entry) {
        // Load link (if exists)
        if (entry.l) {
            var linkList = [];

            $.each(entry.l, function (i, indexLink) {
                var link = { Title: indexLink.t, Link: mSelf.GetIndexLinkPath(indexLink) };

                linkList[linkList.length] = link;
            });

            entry.linkList = mSelf.SortLinkList(linkList);
        }

        if (entry.e) {
            $.each(entry.e, function (term, entry) {
                mSelf.LoadIndexEntry(entry);
            });
        }

        entry.loaded = true;
    }

    this.GetIndexLinkPath = function (indexLink) {
        var link = indexLink.root + indexLink.u;

        if (MadCap.String.StartsWith(link, "/"))
            link = link.substring(1);

        var root = new MadCap.Utilities.Url(mSelf.GetMasterHelpsystem().GetAbsolutePath());
        var href = new MadCap.Utilities.Url(document.location.href);

        if (root.Path.toLowerCase() == href.Path.toLowerCase())
            link = root.AddFile(link).ToRelative(root.Path + mSelf.GetMasterHelpsystem().GetContentPath()).FullPath;

        return link;
    }

    this.MergeIndexEntries = function (entry1, entry2) {
        // merge links
        if (entry2.l) {
            if (typeof entry1.l == 'undefined') {
                entry1.l = entry2.l;
            }
            else {
                entry1.l = entry1.l.concat(entry2.l);
            }
        }

        // merge see also
        if (entry2.r) {
            if (typeof entry1.r == 'undefined') {
                entry1.r = entry2.r;
            }
            else if (entry1.r == 'SeeAlso' || entry2.r == 'SeeAlso') {
                entry1.r = 'SeeAlso';
            }

            if (typeof entry1.f == 'undefined') {
                entry1.f = entry2.f;
            }
            else {
                var seeAlso1 = entry1.f.split(';');
                var seeAlso2 = entry2.f.split(';');
                $.each(seeAlso2, function (i, seeAlso) {
                    if ($.inArray(seeAlso1, seeAlso)) {
                        seeAlso1.push(seeAlso);
                    }
                });
                seeAlso1.sort(function (term1, term2) {
                    var t1 = term1.toLowerCase();
                    var t2 = term2.toLowerCase();

                    return t1 < t2 ? -1 : t1 > t2 ? 1 : 0;
                });
                entry1.f = seeAlso1.join('; ');
            }
        }

        // merge subentries
        if (entry2.e) {
            if (typeof entry1.e == 'undefined') {
                entry1.e = {};
            }

            $.each(entry2.e, function (term, e) {
                if (typeof entry1.e[term] !== 'undefined') {
                    mSelf.MergeIndexEntries(entry1.e[term], e);
                }
                else {
                    entry1.e[term] = e;
                }
            });
        }
    }

    this.FindIndexEntry = function (terms, onCompleteFunc) {
        mSelf.LoadIndex(function (index) {
            if (!index.entries) {
                index.entries = {};
                $.each(index.terms, function (i, entry) {
                    index.entries[entry.t] = entry;
                });
            }

            var termList = terms.split(':');
            var termCount = termList.length;
            var rootEntry = index.entries[termList[0]];

            if (rootEntry) {
                mSelf.LoadRootIndexEntry(rootEntry, function (rootEntry) {
                    var entry = rootEntry;

                    for (var i = 1; i < termCount; i++) {
                        entry = entry.e[termList[i]];
                        if (!entry)
                            break;
                    }

                    if (onCompleteFunc)
                        onCompleteFunc(rootEntry, entry);
                });
            }
            else {
                if (onCompleteFunc)
                    onCompleteFunc();
            }
        });
    }

    this.SortLinkList = function (links) {
        links.sort(function (link1, link2) {
            var title1 = link1.Title.toLowerCase();
            var title2 = link2.Title.toLowerCase();

            return title1 < title2 ? -1 : title1 > title2 ? 1 : 0;
        });

        return links;
    }

    this.GetSearchDBs = function (OnCompleteFunc) {
        var searchDBs = new Array();

        MadCap.Utilities.Xhr.Load(mPath + "Data/Search.xml", true, function (xmlDoc) {
            function OnGetSearchDBsComplete(searchDBs2) {
                if (searchDBs2 != null) {
                    for (var i = 0; i < searchDBs2.length; i++) {
                        searchDBs[searchDBs.length] = searchDBs2[i];
                    }
                }

                completed++;

                if (completed == length) {
                    OnCompleteFunc(searchDBs);
                }
            }

            var completed = 0;
            var length = mSubsystems.length;

            var searchDB = new MadCap.WebHelp.Search.SearchDB(this);
            searchDBs[searchDBs.length] = searchDB;
            searchDB.Load("Data/Search.xml", function () {
                var preMerged = MadCap.Dom.GetAttributeBool(xmlDoc.documentElement, "PreMerged", false);

                if (preMerged || length == 0) {
                    OnCompleteFunc(searchDBs);
                }
                else {
                    for (var i = 0; i < length; i++) {
                        var subsystem = mSubsystems[i];

                        if (!subsystem.GetExists()) {
                            OnGetSearchDBsComplete(null);
                            continue;
                        }

                        subsystem.GetSearchDBs(OnGetSearchDBsComplete);
                    }
                }
            });
        }, null, this);
    };

    this.GetConcepts = function () {
        return mConceptMap;
    };

    this.GetSearchFilters = function () {
        return mFilterMap;
    };

    this.ParseSearchFilterDoc = function (xmlDoc) {
        filterMap = new MadCap.Utilities.Dictionary();

        if (xmlDoc != null) {
            var filters = xmlDoc.getElementsByTagName("SearchFilter");

            for (var i = 0; i < filters.length; i++) {
                var filter = filters[i];
                var name = filter.getAttribute("Name");

                if (!filter.getAttribute("Concepts"))
                    continue;

                var concepts = filter.getAttribute("Concepts").split(";");
                var conceptMap = new MadCap.Utilities.Dictionary();

                filterMap.Add(name, conceptMap);

                for (var j = 0, conceptsLength = concepts.length; j < conceptsLength; j++) {
                    var concept = MadCap.String.Trim(concepts[j]).toLowerCase();

                    conceptMap.Add(concept, true);
                }
            }
        }

        return filterMap;
    };

    this.LoadSearchFilters = function (OnCompleteFunc) {
        function OnGetSearchFilterFileComplete(xmlDoc) {
            mFilterMap = this.ParseSearchFilterDoc(xmlDoc);

            OnCompleteFunc(mFilterMap);
        }

        if (this.SearchFilterSetUrl == null || mFilterMap != null) {
            OnCompleteFunc(mFilterMap);
            return;
        }

        MadCap.Utilities.Xhr.Load(this.SearchFilterSetUrl, true, OnGetSearchFilterFileComplete, null, this);
    };

    this.LoadMergedSearchFilters = function (OnCompleteFunc) {
        function OnGetSearchFiltersComplete(filterMap) {
            if (filterMap != null) {
                filterMap.ForEach(function (key, value) {
                    var conceptMap = mergedFilterMap.GetItem(key);

                    if (conceptMap != null) {
                        value.ForEach(function (key2, value2) {
                            conceptMap.AddUnique(key2, value2);
                        });
                    }
                    else {
                        mergedFilterMap.Add(key, value);
                    }

                    return true;
                });
            }

            completed++;

            if (completed == length + 1)
                OnCompleteFunc(mergedFilterMap);
        }

        var mergedFilterMap = new MadCap.Utilities.Dictionary();

        if (!this.IsWebHelpPlus) {
            var completed = 0;
            var length = mSubsystems.length;

            this.LoadSearchFilters(OnGetSearchFiltersComplete);

            for (var i = 0; i < length; i++) {
                var subsystem = mSubsystems[i];

                if (!subsystem.GetExists()) {
                    OnGetSearchFiltersComplete(null);
                    continue;
                }

                subsystem.LoadSearchFilters(OnGetSearchFiltersComplete);
            }
        }
        else {
            var mSelf = this;

            MadCap.Utilities.Xhr.CallWebService(mPath + "Service/Service.asmx/GetSearchFilters", true, function (xmlDoc, args) {
                var filterMap = mSelf.ParseSearchFilterDoc(xmlDoc);

                OnCompleteFunc(filterMap);
            });
        }
    };

    this.AdvanceTopic = function (tocType, moveType, tocPath, href, CallBackFunc) {
        var file = null;

        mSelf.FindNode(tocType, tocPath, href, function (node) {
            if (node) {
                function AdvanceNode(node, moveType) {
                    node = moveType == 'next' ? GetNextNode(node) : GetPreviousNode(node);

                    if (node && typeof node.i !== 'undefined') {
                        mSelf.LoadTocChunk(node.toc, node.c, function (chunk) {
                            var entry = node.toc.entries[node.i];
                            var link = mSelf.GetTocEntryHref(node, tocType);

                            if (link) {
                                if (MadCap.String.StartsWith(link, '#')) {
                                    link = link.substring(1);
                                }

                                CallBackFunc(link);
                            }
                            else {
                                AdvanceNode(node, moveType);
                            }
                        });
                    }
                }

                AdvanceNode(node, moveType);
            }
        });
    };

    this.SetBrowseSequencePath = function (bsPath, href) {
        var $currentTopicIndex = $(".current-topic-index-button");

        if (bsPath != null) {
            this.FindBrowseSequenceNode(bsPath, href, function (node) {
                if (node && node.parent) {
                    $currentTopicIndex.removeClass("disabled");

                    $(".sequence-index").text(node.parent.n.indexOf(node) + 1);
                    $(".sequence-total").text(node.parent.n.length);
                }
                else {
                    $currentTopicIndex.addClass("disabled");
                }
            });
        }
        else {
            $currentTopicIndex.addClass("disabled");
        }
    }

    // Private member functions

    function GetDataFileUrl(xmlDoc, att) {
        var url = xmlDoc.documentElement.getAttribute(att);

        if (url == null) {
            return null;
        }

        var root = new MadCap.Utilities.Url(mPath);

        if (!root.IsAbsolute) {
            return mPath + url;
        }

        return root.AddFile(url).ToRelative(document.location.href).FullPath;
    }

    function CacheSkins(xmlDoc) {
        var skinNodes = $("CatapultSkin", xmlDoc.documentElement);

        for (var i = 0, length = skinNodes.length; i < length; i++) {
            var skinNode = skinNodes[i];
            var $skinNode = $(skinNode);
            var skinName = $skinNode.attr("Name");
            var skinData = {};

            for (var j = 0, length2 = skinNode.attributes.length; j < length2; j++) {
                var att = skinNode.attributes[j];
                skinData[att.name] = att.value;
            }

            var children = $skinNode.children();

            for (var j = 0, length2 = children.length; j < length2; j++) {
                var childNode = children[j];
                var name = childNode.nodeName;
                var nodeData = {};
                skinData[name] = nodeData;

                for (var k = 0, length3 = childNode.attributes.length; k < length3; k++) {
                    var att = childNode.attributes[k];
                    nodeData[att.name] = att.value;
                }
            }

            mSkinMap.Add(skinName, skinData);
        }
    }

    function ConvertGlossaryPageEntryToAbsolute(glossaryPageEntry, path) {
        if (glossaryPageEntry.nodeName.toLowerCase() == "madcap:glossarychunkref") {
            var $glossaryPageEntry = $(glossaryPageEntry);
            var href = $glossaryPageEntry.attr("src");

            if (!MadCap.String.IsNullOrEmpty(href)) {
                var url = new MadCap.Utilities.Url(path).CombinePath("../../Data/").CombinePath(href);

                $glossaryPageEntry.attr("src", "../" + url.FullPath);
            }
        }
        else {
            var entryNode = glossaryPageEntry.getElementsByTagName("a")[0];
            var href = $(entryNode).attr("href");

            if (!MadCap.String.IsNullOrEmpty(href)) {
                var url = new MadCap.Utilities.Url(path).CombinePath("../../Content/").CombinePath(href);

                $(entryNode).attr("href", "../" + url.FullPath);
            }
        }
    }

    function ConvertIndexLinksToAbsolute(indexEntry) {
        for (var i = 0; i < indexEntry.childNodes.length; i++) {
            var currNode = indexEntry.childNodes[i];

            if (currNode.nodeName == "Entries") {
                for (var j = 0; j < currNode.childNodes.length; j++)
                    ConvertIndexLinksToAbsolute(currNode.childNodes[j]);
            }
            else if (currNode.nodeName == "Links") {
                for (var j = 0; j < currNode.childNodes.length; j++) {
                    if (currNode.childNodes[j].nodeType == 1) {
                        var link = MadCap.Dom.GetAttribute(currNode.childNodes[j], "Link");

                        link = mPath + ((link.charAt(0) == "/") ? link.substring(1, link.length) : link);
                        currNode.childNodes[j].setAttribute("Link", link);
                    }
                }
            }
        }
    }

    function MergeConceptLinks(links1, links2) {
        if (!links2)
            return;

        for (var i = 0; i < links2.length; i++)
            links1[links1.length] = links2[i];
    }

    function MergeGlossaries(glossary1, subsystem, OnCompleteFunc) {
        subsystem.GetGlossary(function (glossary2) {
            if (typeof glossary2 == 'undefined') {
                OnCompleteFunc();
                return;
            }

            // Append chunk paths
            glossary1.chunks = glossary1.chunks.concat(glossary2.chunks);

            // Merge terms
            for (var i = 0, j = 0; i < glossary1.terms.length && j < glossary2.terms.length; ) {
                var entry1 = glossary1.terms[i];
                var entry2 = glossary2.terms[j];

                var term1 = entry1.t;
                var term2 = entry2.t;

                if (term1.toLowerCase() == term2.toLowerCase()) {
                    i++;
                    j++;
                }
                else if (term1.toLowerCase() > term2.toLowerCase()) {
                    entry2.c += glossary1.numchunks;
                    glossary1.terms.splice(i, 0, entry2);

                    j++;
                }
                else {
                    i++;
                }
            }

            // Append remaining nodes.
            for (; j < glossary2.terms.length; j++) {
                var entry = glossary2.terms[j];
                entry.c += glossary1.numchunks;
                glossary1.terms.push(entry);
            }

            glossary1.numchunks = glossary1.chunks.length;

            OnCompleteFunc();
        });
    }

    function MergeIndexes(index1, subsystem, OnCompleteFunc) {
        subsystem.GetIndex(function (index2) {
            if (typeof index2 == 'undefined') {
                OnCompleteFunc();
                return;
            }

            // Append chunk paths
            index1.chunks = index1.chunks.concat(index2.chunks);

            // Merge terms
            for (var i = 0, j = 0; i < index1.terms.length && j < index2.terms.length; ) {
                var entry1 = index1.terms[i];
                var entry2 = index2.terms[j];

                var term1 = entry1.s || entry1.t; // sort as or term
                var term2 = entry2.s || entry2.t;

                if (term1 == term2 && entry1.t == entry2.t) {
                    if (typeof entry1.c == 'number') {
                        entry1.c = [entry1.c];
                    }

                    var chunks = entry2.c;
                    if (typeof entry2.c == 'number') {
                        chunks = [entry2.c];
                    }

                    $.each(chunks, function (index, chunk) {
                        entry1.c.push(chunk + index1.numchunks);
                    });

                    entry1.$ = (entry1.$ === 1 && entry2.$ === 1) ? 1 : 0;

                    i++;
                    j++;
                }
                else if (term1.toLowerCase() > term2.toLowerCase() ||
                    (term1.toLowerCase() == term2.toLowerCase() && entry1.t.toLowerCase() > entry2.t.toLowerCase())) {
                    entry2.c += index1.numchunks;
                    index1.terms.splice(i, 0, entry2);

                    j++;
                }
                else {
                    i++;
                }
            }

            // Append remaining nodes.
            for (; j < index2.terms.length; j++) {
                var entry = index2.terms[j];
                entry.c += index1.numchunks;
                index1.terms.push(entry);
            }

            index1.numchunks = index1.chunks.length;

            OnCompleteFunc();
        });
    }
};

(function ()
{
    var _HelpSystem = null;

    MadCap.WebHelp.HelpSystem.GetHelpSystem = function ()
    {
        return _HelpSystem;
    };

    MadCap.WebHelp.HelpSystem.LoadHelpSystem = function (path, OnCompleteFunc)
    {
        _HelpSystem = new MadCap.WebHelp.HelpSystem(null, null, path, null, null);
        _HelpSystem.Load(function ()
        {
            OnCompleteFunc(_HelpSystem);
        });
    };
})();

//
//    End class HelpSystem
//

//
//    Class TocFile
//

MadCap.WebHelp.TocFile = function (helpSystem, tocType)
{
    // Private member variables

    var mSelf = this;
    var mHelpSystem = helpSystem;
    var mTocType = tocType;
    var mInitialized = false;
    var mRootNode = null;
    var mInitOnCompleteFuncs = new Array();
    var mTocPath = null;
    var mTocHref = null;
    var mOwnerHelpSystems = new Array();

    // Public properties

    // Constructor

    (function ()
    {
    })();

    // Public member functions

    this.Init = function (OnCompleteFunc)
    {
        if (mInitialized)
        {
            if (OnCompleteFunc != null)
                OnCompleteFunc();

            return;
        }

        //

        if (OnCompleteFunc != null)
            mInitOnCompleteFuncs.push(OnCompleteFunc);

        //

        var fileName = null;

        if (tocType == MadCap.WebHelp.TocFile.TocType.Toc)
            fileName = "Toc.xml";
        else if (tocType == MadCap.WebHelp.TocFile.TocType.BrowseSequence)
            fileName = "BrowseSequences.xml";

        this.LoadToc(mHelpSystem.GetPath() + "Data/" + fileName, OnLoadTocComplete);

        function OnLoadTocComplete(xmlDoc)
        {
            mInitialized = true;

            mRootNode = xmlDoc.documentElement;

            InitOnComplete();
        }
    };

    this.LoadToc = function (xmlFile, OnCompleteFunc)
    {
        if (mTocType == MadCap.WebHelp.TocFile.TocType.Toc && mHelpSystem.IsWebHelpPlus)
        {
            MadCap.Utilities.Xhr.CallWebService(mHelpSystem.GetPath() + "Service/Service.asmx/GetToc", true, OnTocXmlLoaded, null);
        }
        else if (mTocType == MadCap.WebHelp.TocFile.TocType.BrowseSequence && mHelpSystem.IsWebHelpPlus)
        {
            MadCap.Utilities.Xhr.CallWebService(mHelpSystem.GetPath() + "Service/Service.asmx/GetBrowseSequences", true, OnTocXmlLoaded, null);
        }
        else
        {
            var xmlPath = (xmlFile.indexOf("/") == -1) ? mHelpSystem.GetPath() + "Data/" + xmlFile : xmlFile;

            MadCap.Utilities.Xhr.Load(xmlPath, false, OnTocXmlLoaded, null, null);
        }

        function OnTocXmlLoaded(xmlDoc, args)
        {
            if (!xmlDoc || !xmlDoc.documentElement)
            {
                if (OnCompleteFunc != null)
                    OnCompleteFunc(xmlDoc);

                return;
            }

            //

            if (OnCompleteFunc != null)
                OnCompleteFunc(xmlDoc);
        }
    };

    this.LoadChunk = function (parentNode, xmlFile, OnCompleteFunc)
    {
        var xmlPath = (xmlFile.indexOf("/") == -1) ? mHelpSystem.GetPath() + "Data/" + xmlFile : xmlFile;

        MadCap.Utilities.Xhr.Load(xmlFile, true, OnTocXmlLoaded, null, null);

        function OnTocXmlLoaded(xmlDoc, args)
        {
            if (!xmlDoc || !xmlDoc.documentElement)
            {
                if (OnCompleteFunc != null)
                    OnCompleteFunc(parentNode);

                return;
            }

            parentNode.removeAttribute("Chunk");

            var rootNode = xmlDoc.documentElement;

            for (var i = 0, length = rootNode.childNodes.length; i < length; i++)
            {
                var childNode = rootNode.childNodes[i];

                if (childNode.nodeType != 1) { continue; }

                var importedNode = null;

                if (typeof (xmlDoc.importNode) == "function")
                    importedNode = xmlDoc.importNode(childNode, true);
                else
                    importedNode = childNode.cloneNode(true);

                parentNode.appendChild(importedNode);
            }

            //

            if (OnCompleteFunc != null)
                OnCompleteFunc(parentNode);
        }
    }

    this.LoadMerge = function (parentNode, OnCompleteFunc)
    {
        var mergeHint = MadCap.Dom.GetAttributeInt(parentNode, "MergeHint", -1);

        if (mergeHint == -1)
        {
            OnCompleteFunc(parentNode, false, null, null);

            return;
        }

        parentNode.removeAttribute("MergeHint");

        var ownerHelpSystem = GetOwnerHelpSystem(parentNode);
        var subsystem = ownerHelpSystem.GetSubsystem(mergeHint);
        var replace = MadCap.Dom.GetAttributeBool(parentNode, "ReplaceMergeNode", false);

        if (!replace)
            parentNode.setAttribute("ownerHelpSystemIndex", mOwnerHelpSystems.length);

        mOwnerHelpSystems[mOwnerHelpSystems.length] = subsystem;

        var xmlPath = subsystem.GetPath() + "Data/" + (mTocType == MadCap.WebHelp.TocFile.TocType.Toc ? "Toc.xml" : "BrowseSequences.xml");
        var xmlDoc = MadCap.Utilities.Xhr.Load(xmlPath, true, OnTocXmlLoaded);

        function OnTocXmlLoaded(xmlDoc, args)
        {
            if (!xmlDoc || !xmlDoc.documentElement)
            {
                if (OnCompleteFunc != null)
                    OnCompleteFunc(parentNode, false, null, null);

                return;
            }

            var rootNode = xmlDoc.documentElement;
            var currNode = null;
            var isFirst = true;
            var firstNode = null;
            var lastNode = null;
            var parentXmlDoc = parentNode.ownerDocument;

            for (var i = 0, length = rootNode.childNodes.length; i < length; i++)
            {
                var childNode = rootNode.childNodes[i];

                if (childNode.nodeType != 1) { continue; }

                var importedNode = null;

                if (typeof (parentXmlDoc.importNode) == "function")
                    importedNode = parentXmlDoc.importNode(childNode, true);
                else
                    importedNode = childNode.cloneNode(true);

                if (replace)
                {
                    importedNode.setAttribute("ownerHelpSystemIndex", mOwnerHelpSystems.length - 1);

                    if (isFirst)
                    {
                        isFirst = false;

                        parentNode.parentNode.replaceChild(importedNode, parentNode);

                        firstNode = importedNode;
                        lastNode = firstNode;
                    }
                    else
                    {
                        currNode.parentNode.insertBefore(importedNode, currNode.nextSibling);

                        lastNode = importedNode;
                    }

                    currNode = importedNode
                }
                else
                {
                    parentNode.appendChild(importedNode);
                }
            }

            //

            if (OnCompleteFunc != null)
                OnCompleteFunc(parentNode, replace, firstNode, lastNode);
        }
    }

    this.AdvanceTopic = function (moveType, tocPath, href, CallBackFunc)
    {
        this.GetTocNode(tocPath, href, OnComplete);

        function OnComplete(tocNode)
        {
            if (tocNode == null)
            {
                CallBackFunc(null);
                return;
            }

            var moveNode = null;

            GetMoveTocTopicNode(moveType, tocNode, OnGetMoveTocNodeComplete);

            function OnGetMoveTocNodeComplete(moveNode)
            {
                var href = null;

                if (moveNode != null)
                {
                    href = MadCap.Dom.GetAttribute(moveNode, "Link");

                    //if (FMCIsHtmlHelp())
                    //    href = href.substring("/Content/".length);
                    //else
                    href = href.substring("/".length);

                    var hrefUrl = new MadCap.Utilities.Url(href);

                    // CHMs don't support query strings in links
                    //if (!FMCIsHtmlHelp())
                    {
                        var prefix = null;

                        if (mTocType == MadCap.WebHelp.TocFile.TocType.Toc)
                            prefix = "TocPath";
                        else if (mTocType == MadCap.WebHelp.TocFile.TocType.BrowseSequence)
                            prefix = "BrowseSequencePath";

                        var tocPath = GetTocPath(moveNode, false);
                        var newHrefUrl = hrefUrl.ToQuery(prefix + "=" + encodeURIComponent(tocPath));

                        href = newHrefUrl.FullPath;
                    }

                    var subsystem = GetOwnerHelpSystem(moveNode);

                    href = subsystem.GetPath() + href;

                    CallBackFunc(href);
                }
                else
                {
                    CallBackFunc(href);
                }
            }
        }
    };

    this.GetRootNode = function (onCompleteFunc)
    {
        this.Init(OnInit);

        function OnInit()
        {
            onCompleteFunc(mRootNode);
        }
    };

    this.GetTocNode = function (tocPath, href, onCompleteFunc)
    {
        this.Init(OnInit);

        function OnInit()
        {
            mTocPath = tocPath;
            mTocHref = href;

            //

            var steps = (tocPath == "") ? new Array(0) : tocPath.split("|");
            var linkNodeIndex = -1;

            if (steps.length > 0)
            {
                var lastStep = steps[steps.length - 1];

                if (MadCap.String.StartsWith(lastStep, "_____"))
                {
                    linkNodeIndex = parseInt(lastStep.substring("_____".length));
                    steps.splice(steps.length - 1, 1);
                }
            }

            var tocNode = mRootNode;

            for (var i = 0, length = steps.length; i < length; i++)
            {
                if (CheckChunk(tocNode))
                    return;

                if (CheckMerge(tocNode))
                    return;

                //

                tocNode = FindBook(tocNode, decodeURIComponent(steps[i]));
            }

            if (tocNode == null)
            {
                onCompleteFunc(null);

                return;
            }

            if (CheckChunk(tocNode))
            {
                return;
            }

            if (CheckMerge(tocNode))
            {
                return;
            }

            if (linkNodeIndex >= 0)
            {
                if (linkNodeIndex == 0)
                    foundNode = tocNode;
                else
                    foundNode = $(tocNode).children("TocEntry")[linkNodeIndex - 1];
            }
            else
            {
                var ownerHelpSystem = GetOwnerHelpSystem(tocNode);
                var relHref = href.ToRelative(new MadCap.Utilities.Url(ownerHelpSystem.GetPath()));
                var foundNode = FindLink(tocNode, relHref.FullPath.toLowerCase(), true);

                if (!foundNode)
                    foundNode = FindLink(tocNode, relHref.PlainPath.toLowerCase(), false);
            }

            //

            mTocPath = null;
            mTocHref = null;

            //

            onCompleteFunc(foundNode);
        }

        function CheckChunk(tocNode)
        {
            var chunk = MadCap.Dom.GetAttribute(tocNode, "Chunk");

            if (chunk != null)
            {
                mSelf.LoadChunk(tocNode, chunk,
					function (tocNode)
					{
					    mSelf.GetTocNode(mTocPath, mTocHref, onCompleteFunc)
					}
				);

                return true;
            }

            return false;
        }

        function CheckMerge(tocNode)
        {
            var mergeHint = $(tocNode).attr("MergeHint") || -1;

            if (mergeHint >= 0)
            {
                mSelf.LoadMerge(tocNode,
					function (tocNode)
					{
					    mSelf.GetTocNode(mTocPath, mTocHref, onCompleteFunc)
					}
				);

                return true;
            }

            return false;
        }
    };

    this.GetEntrySequenceIndex = function (tocPath, href, onCompleteFunc)
    {
        this.GetTocNode(tocPath, href, OnCompleteGetTocNode);

        function OnCompleteGetTocNode(tocNode)
        {
            var sequenceIndex = -1;

            if (tocNode != null)
                sequenceIndex = ComputeEntrySequenceIndex(tocNode);

            onCompleteFunc(sequenceIndex);
        }
    };

    this.GetIndexTotalForEntry = function (tocPath, href, onCompleteFunc)
    {
        this.GetTocNode(tocPath, href, OnCompleteGetTocNode);

        function OnCompleteGetTocNode(tocNode)
        {
            var total = -1;

            if (tocNode != null)
            {
                var currNode = tocNode;

                while (currNode.parentNode != mRootNode)
                {
                    currNode = currNode.parentNode;
                }

                total = MadCap.Dom.GetAttributeInt(currNode, "DescendantCount", -1);
            }

            onCompleteFunc(total);
        }
    };

    // Private member functions

    function InitOnComplete()
    {
        for (var i = 0, length = mInitOnCompleteFuncs.length; i < length; i++)
        {
            mInitOnCompleteFuncs[i]();
        }
    }

    function FindBook(tocNode, step)
    {
        var foundNode = null;

        for (var i = 0; i < tocNode.childNodes.length; i++)
        {
            if (tocNode.childNodes[i].nodeName == "TocEntry" && MadCap.Dom.GetAttribute(tocNode.childNodes[i], "Title") == step)
            {
                foundNode = tocNode.childNodes[i];

                break;
            }
        }

        return foundNode;
    }

    function FindLink(node, bodyHref, exactMatch)
    {
        var foundNode = null;
        var bookHref = MadCap.Dom.GetAttribute(node, "Link");

        if (bookHref != null)
        {
            //            if (FMCIsHtmlHelp())
            //                bookHref = bookHref.substring("/Content/".length);
            //            else
            bookHref = bookHref.substring("/".length);

            bookHref = bookHref.replace(/%20/g, " ");
            bookHref = bookHref.toLowerCase();
        }

        if (bookHref == bodyHref)
        {
            foundNode = node;
        }
        else
        {
            for (var k = 0; k < node.childNodes.length; k++)
            {
                var currNode = node.childNodes[k];

                if (currNode.nodeType != 1) { continue; }

                var currTopicHref = MadCap.Dom.GetAttribute(currNode, "Link");

                if (currTopicHref == null)
                    continue;

                //                if (FMCIsHtmlHelp())
                //                    currTopicHref = currTopicHref.substring("/Content/".length);
                //                else
                currTopicHref = currTopicHref.substring("/".length);

                currTopicHref = currTopicHref.replace(/%20/g, " ");
                currTopicHref = currTopicHref.toLowerCase();

                if (!exactMatch)
                {
                    var hashPos = currTopicHref.indexOf("#");

                    if (hashPos != -1)
                        currTopicHref = currTopicHref.substring(0, hashPos);

                    var searchPos = currTopicHref.indexOf("?");

                    if (searchPos != -1)
                        currTopicHref = currTopicHref.substring(0, searchPos);
                }

                if (currTopicHref == bodyHref)
                {
                    foundNode = currNode;

                    break;
                }
            }
        }

        return foundNode;
    }

    function GetMoveTocTopicNode(moveType, tocNode, onCompleteFunc)
    {
        if (moveType == "previous")
            GetPreviousNode(tocNode);
        else if (moveType == "next")
            GetNextNode(tocNode);

        function OnCompleteGetNode(moveNode)
        {
            var moveTopicNode = null;

            if (moveNode != null)
            {
                var link = MadCap.Dom.GetAttribute(moveNode, "Link");

                if (link == null)
                {
                    GetMoveTocTopicNode(moveType, moveNode, onCompleteFunc);

                    return;
                }

                var linkUrl = new MadCap.Utilities.Url(link);
                var ext = linkUrl.Extension.toLowerCase();
                var masterHS = mHelpSystem.GetMasterHelpsystem();

                if (masterHS.UseCustomTopicFileExtension)
                {
                    if (ext != masterHS.CustomTopicFileExtension)
                    {
                        GetMoveTocTopicNode(moveType, moveNode, onCompleteFunc);
                        return;
                    }
                }
                else if (ext != "htm" && ext != "html")
                {
                    GetMoveTocTopicNode(moveType, moveNode, onCompleteFunc);
                    return;
                }

                moveTopicNode = moveNode;
            }

            onCompleteFunc(moveTopicNode);
        }

        function GetPreviousNode(tocNode)
        {
            function OnLoadChunk(tNode)
            {
                var childTocNode = GetDeepestChild(tNode, "TocEntry");

                if (childTocNode == null)
                {
                    previousNode = tNode;
                }
                else
                {
                    previousNode = childTocNode;

                    if (CheckChunk(childTocNode, OnLoadChunk))
                    {
                        return;
                    }

                    if (CheckMerge(childTocNode, OnLoadMerge))
                        return;
                }

                OnCompleteGetNode(previousNode);
            }

            function OnLoadMerge(tNode, replaced, firstNode, lastNode)
            {
                if (replaced)
                    OnLoadChunk(lastNode);
                else
                    OnLoadChunk(tNode);
            }

            var previousNode = null;

            for (var currNode = tocNode.previousSibling; currNode != null; currNode = currNode.previousSibling)
            {
                if (currNode.nodeName == "TocEntry")
                {
                    previousNode = currNode;
                    break;
                }
            }

            if (previousNode != null)
            {
                if (CheckChunk(previousNode, OnLoadChunk))
                    return;

                if (CheckMerge(previousNode, OnLoadMerge))
                    return;

                OnLoadChunk(previousNode);

                return;
            }
            else
            {
                if (tocNode.parentNode.nodeType == 1)
                    previousNode = tocNode.parentNode;
            }

            OnCompleteGetNode(previousNode);
        }

        function GetNextNode(tocNode)
        {
            function OnLoadChunk(tNode)
            {
                var nextNode = $(tNode).children("TocEntry")[0];

                for (var currNode = tNode; currNode != null && nextNode == null; currNode = currNode.parentNode)
                {
                    nextNode = $(currNode).next("TocEntry")[0];
                }

                OnCompleteGetNode(nextNode);
            }

            function OnLoadMerge(tNode, replaced, firstNode, lastNode)
            {
                if (replaced)
                {
                    OnCompleteGetNode(firstNode);

                    return;
                }

                OnLoadChunk(tNode);
            }

            var nextNode = null;

            if (CheckChunk(tocNode, OnLoadChunk))
                return;

            if (CheckMerge(tocNode, OnLoadMerge))
                return;

            OnLoadChunk(tocNode);
        }

        function CheckChunk(tocNode, OnCompleteFunc)
        {
            var chunk = MadCap.Dom.GetAttribute(tocNode, "Chunk");

            if (chunk != null)
            {
                mSelf.LoadChunk(tocNode, chunk, OnCompleteFunc);

                return true;
            }

            return false;
        }

        function CheckMerge(tocNode, OnCompleteFunc)
        {
            var mergeHint = $(tocNode).attr("MergeHint") || -1;

            if (mergeHint >= 0)
            {
                mSelf.LoadMerge(tocNode, OnCompleteFunc);

                return true;
            }

            return false;
        }
    }

    function GetDeepestChild(tocNode, nodeName)
    {
        var node = $(tocNode).children(nodeName + ":last")[0];

        if (node != null)
        {
            var nodeChild = GetDeepestChild(node, nodeName);

            if (nodeChild != null)
                return nodeChild;

            return node;
        }

        return null;
    }

    function GetOwnerHelpSystem(tocNode)
    {
        var ownerHelpSystem = null;
        var currNode = tocNode;

        while (true)
        {
            if (currNode == currNode.ownerDocument.documentElement)
            {
                ownerHelpSystem = mHelpSystem;

                break;
            }

            var ownerHelpSystemIndex = MadCap.Dom.GetAttributeInt(currNode, "ownerHelpSystemIndex", -1);

            if (ownerHelpSystemIndex >= 0)
            {
                ownerHelpSystem = mOwnerHelpSystems[ownerHelpSystemIndex];

                break;
            }

            currNode = currNode.parentNode;
        }

        return ownerHelpSystem;
    }

    function GetTocPath(tocNode)
    {
        var tocPath = "";
        var linkNodeIndex = -1;
        var childNode = $(tocNode).children("TocEntry")[0];

        if (childNode != null)
        {
            tocPath = encodeURIComponent(MadCap.Dom.GetAttribute(tocNode, "Title"));

            linkNodeIndex = 0;
        }
        else
        {
            linkNodeIndex = $(tocNode).index() + 1;
        }

        if (tocPath.length > 0)
            tocPath += "|";

        tocPath += ("_____" + linkNodeIndex);

        for (var currNode = tocNode.parentNode; currNode != null && currNode.parentNode.nodeType == 1; currNode = currNode.parentNode)
        {
            if (tocPath == null)
                tocPath = "";

            if (tocPath.length > 0)
                tocPath = "|" + tocPath;

            tocPath = encodeURIComponent(MadCap.Dom.GetAttribute(currNode, "Title")) + tocPath;
        }

        return tocPath;
    }

    function ComputeEntrySequenceIndex(tocNode)
    {
        if (tocNode.parentNode == tocNode.ownerDocument.documentElement)
            return 0;

        var sequenceIndex = 0;

        var link = MadCap.Dom.GetAttribute(tocNode, "Link");

        if (link != null)
            sequenceIndex++;

        for (var currNode = tocNode.previousSibling; currNode != null; currNode = currNode.previousSibling)
        {
            if (currNode.nodeType != 1) { continue; }

            var descendantCount = MadCap.Dom.GetAttributeInt(currNode, "DescendantCount", 0);

            sequenceIndex += descendantCount;

            var link = MadCap.Dom.GetAttribute(currNode, "Link");

            if (link != null)
            {
                var linkUrl = new MadCap.Utilities.Url(link);
                var ext = linkUrl.Extension.toLowerCase();

                if (ext == "htm" || ext == "html")
                    sequenceIndex++;
            }
        }

        return sequenceIndex + ComputeEntrySequenceIndex(tocNode.parentNode);
    }
};

// Enumerations

MadCap.WebHelp.TocFile.TocType =
{
    "Toc": 0,
    "BrowseSequence": 1
};

//
//    End class TocFile
//

//
//    Class AliasFile
//
MadCap.WebHelp.AliasFile = function (xmlFile, helpSystem, OnLoadFunc)
{
    // Private member variables

    var mRootNode = null;
    var mHelpSystem = helpSystem;
    var mNameMap = null;
    var mIDMap = null;

    // Public properties

    // Constructor

    (function ()
    {
    })();

    // Public member functions

    this.Load = function (OnCompleteFunc)
    {
        MadCap.Utilities.Xhr.Load(xmlFile, true, function OnLoad(xmlDoc)
        {
            if (xmlDoc)
                mRootNode = xmlDoc.documentElement;

            OnCompleteFunc();
        });
    };

    this.GetIDs = function ()
    {
        var ids = new Array();

        AssureInitializedMap();

        mIDMap.ForEach(function (key, value)
        {
            ids[ids.length] = key;

            return true;
        });

        return ids;
    };

    this.GetNames = function ()
    {
        var names = new Array();

        AssureInitializedMap();

        mNameMap.ForEach(function (key, value)
        {
            names[names.length] = key;

            return true;
        });

        return names;
    };

    this.LookupID = function (id)
    {
        var found = false;
        var topic = null;
        var skin = null;

        if (id)
        {
            if (typeof (id) == "string" && id.indexOf(".") != -1)
            {
                var pipePos = id.indexOf("|");

                if (pipePos != -1)
                {
                    topic = id.substring(0, pipePos);
                    skin = id.substring(pipePos + 1);
                }
                else
                {
                    topic = id;
                }

                found = true;
            }
            else
            {
                var mapInfo = GetFromMap(id);

                if (mapInfo != null)
                {
                    found = true;
                    topic = mapInfo.Topic;
                    skin = mapInfo.Skin;
                }
            }
        }
        else
        {
            found = true;
        }

        if (topic)
            topic = mHelpSystem.ContentFolder + topic;

        return { Found: found, Topic: topic, Skin: skin };
    };

    // Private member functions

    function GetFromMap(id)
    {
        var mapInfo = null;

        AssureInitializedMap();

        if (mNameMap != null)
        {
            if (typeof (id) == "string")
            {
                mapInfo = mNameMap.GetItem(id);

                if (mapInfo == null)
                    mapInfo = mIDMap.GetItem(id);
            }
            else if (typeof (id) == "number")
            {
                mapInfo = mIDMap.GetItem(id.toString());
            }
        }

        return mapInfo;
    }

    function AssureInitializedMap()
    {
        if (mNameMap == null)
        {
            if (mRootNode)
            {
                mNameMap = new MadCap.Utilities.Dictionary();
                mIDMap = new MadCap.Utilities.Dictionary();

                var maps = mRootNode.getElementsByTagName("Map");

                for (var i = 0; i < maps.length; i++)
                {
                    var topic = maps[i].getAttribute("Link");
                    var skin = maps[i].getAttribute("Skin");
                    var currMapInfo = { Topic: topic, Skin: skin };

                    var name = maps[i].getAttribute("Name");

                    if (name != null)
                        mNameMap.Add(name, currMapInfo);

                    var resolvedId = maps[i].getAttribute("ResolvedId");

                    if (resolvedId != null)
                        mIDMap.Add(resolvedId, currMapInfo);
                }
            }
        }
    }
};

//
//    End class AliasFile
//

//
//    Class IndexEntry
//

MadCap.WebHelp.IndexEntry = function (indexEntry, level)
{
    // Public properties

    var indexLinks = MadCap.Dom.GetChildNodeByTagName(indexEntry, "Links", 0).childNodes;
    var numNodes = indexLinks.length;
    var nodeCount = 0;

    this.Term = MadCap.Dom.GetAttribute(indexEntry, "Term");
    this.IndexLinks = new Array();
    this.Level = level;
    this.GeneratedReferenceType = MadCap.Dom.GetAttribute(indexEntry, "GeneratedReferenceType");

    for (var i = 0; i < numNodes; i++)
    {
        var indexLink = indexLinks[i];

        if (indexLink.nodeType != 1) { continue; }

        this.IndexLinks[nodeCount] = new MadCap.WebHelp.IndexLink(indexLink);

        nodeCount++;
    }
};

//
//    End class IndexEntry
//

//
//    Class IndexLink
//

MadCap.WebHelp.IndexLink = function (indexLink)
{
    this.Title = MadCap.Dom.GetAttribute(indexLink, "Title");
    this.Link = MadCap.Dom.GetAttribute(indexLink, "Link");
};

//
//    End class IndexLink
//
