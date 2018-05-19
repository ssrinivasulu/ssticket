/// <reference path="../../Scripts/jquery.js" />
/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapXhr.js" />
/// <reference path="../../Scripts/MadCapFeedback.js" />
/// <reference path="MadCapHelpSystem.js" />
/// <reference path="MadCapStemmer.js" />
/// <reference path="MadCapParser.js" />

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

    MadCap.WebHelp.SearchPane = function (helpSystem) {
        this._Init = false;
        this._HelpSystem = helpSystem;
        this._FeedbackController = null;
        this._Parser = null;
        this._Filters = null;
        this._FullSet = null;
        this._MergedSet = null;
        this._FilteredSet = null;
        this._Highlight = "";
        this._DownloadedSynonymXmlDocRootNode = null;
    };

    var SearchPane = MadCap.WebHelp.SearchPane;

    SearchPane.SearchDBs = new Array(); // Fix from being static/global.

    SearchPane.prototype.Init = function (OnCompleteFunc) {
        if (this._Init) {
            if (OnCompleteFunc) {
                OnCompleteFunc();
            }

            return;
        }

        var mSelf = this;

        if (this._HelpSystem.LiveHelpEnabled) {
            this._FeedbackController = new MadCap.WebHelp.FeedbackController(this._HelpSystem.LiveHelpServer);
            this._FeedbackController.Init(function () {
                if (mSelf._FeedbackController.FeedbackActive) {
                    mSelf._FeedbackController.GetSynonymsFile(mSelf._HelpSystem.LiveHelpOutputId, null, function (synonymsXmlDoc, onCompleteArgs) {
                        var xmlDoc = MadCap.Utilities.Xhr.LoadXmlString(synonymsXmlDoc);

                        if (xmlDoc != null)
                            mSelf._DownloadedSynonymXmlDocRootNode = xmlDoc.documentElement;

                        OnGetSynonymsComplete();
                    }, null);
                }
                else {
                    OnGetSynonymsComplete();
                }
            });
        }
        else {
            OnGetSynonymsComplete();
        }

        function OnGetSynonymsComplete() {
            if (!mSelf._HelpSystem.IsWebHelpPlus) {
                mSelf._HelpSystem.GetSearchDBs(OnGetSearchDBsComplete);
            }
            else {
                OnGetSearchDBsComplete(null);
            }
        }

        function OnGetSearchDBsComplete(searchDBs) {
            SearchPane.SearchDBs = searchDBs;

            mSelf._Filters = new Search.Filters(mSelf._HelpSystem);
            mSelf._Filters.Load(function () {
                mSelf._Init = true;

                if (OnCompleteFunc) {
                    OnCompleteFunc();
                }
            });
        }
    };

    SearchPane.prototype.ApplySearchFilter = function (filterName, OnCompleteFunc) {
        if (!this._HelpSystem.IsWebHelpPlus) {
            this._FilteredSet = this._Filters.ApplyFilter(this._MergedSet, filterName);

            if (this._FilteredSet != null) {
                this._FilteredSet.SortByRank();
            }

            if (OnCompleteFunc != null) {
                OnCompleteFunc(this._FilteredSet);
            }
        }
    };

    SearchPane.prototype.StartSearch = function (searchQuery, filterName, OnSearchFinishedFunc) {
        if (MadCap.String.IsNullOrEmpty(MadCap.String.Trim(searchQuery))) {
            return;
        }

        if (!this._HelpSystem.IsWebHelpPlus) {
            this.DoSearch(searchQuery, filterName, OnSearchFinishedFunc);
        }
        else {
            this.DoSearchWebHelpPlus(searchQuery, filterName, OnSearchFinishedFunc);
        }
    };

    SearchPane.prototype.StartPulseSearch = function (searchQuery, pageSize, pageIndex, OnSearchFinishedFunc) {
        if (MadCap.String.IsNullOrEmpty(MadCap.String.Trim(searchQuery))) {
            return;
        }

        if (this._FeedbackController && this._FeedbackController.PulseActive) {
            this._FeedbackController.GetPulseSearchResults(this._HelpSystem.LiveHelpOutputId, searchQuery, pageSize, pageIndex, OnSearchFinishedFunc);
        }
        else if (OnSearchFinishedFunc != null) {
            OnSearchFinishedFunc();
        }
    };

    SearchPane.prototype.DoSearch = function (searchQuery, filterName, OnCompleteFunc) {
        this._Parser = new Search.Parser(searchQuery);
        var root = null;

        try {
            root = this._Parser.ParseExpression();
        }
        catch (err) {
            alert("Ensure that the search string is properly formatted.");
            OnCompleteFunc();
        }

        if (!root) {
            return;
        }

        if (this._DownloadedSynonymXmlDocRootNode != null && SearchPane.SearchDBs[0].DownloadedSynonymFile == null) {
            SearchPane.SearchDBs[0].DownloadedSynonymFile = new Search.SynonymFile(this._DownloadedSynonymXmlDocRootNode);
        }

        var mSelf = this;

        root.Evaluate(false, false, function (resultSet) {
            mSelf._FullSet = resultSet;

            if (mSelf._FullSet) {
                mSelf._MergedSet = mSelf._FullSet.ToMerged();
                mSelf.ApplySearchFilter(filterName, function (filteredSet) {
                    if (OnCompleteFunc != null) {
                        OnCompleteFunc(filteredSet);
                    }
                });
            }
        });
    };

    SearchPane.prototype.DoSearchWebHelpPlus = function (searchQuery, filterName, OnCompleteFunc) {
        function OnGetSearchResultsComplete(xmlDoc, args) {
            var resultSet = new Search.SearchResultSet();
            var results = xmlDoc.getElementsByTagName("Result");
            var resultsLength = results.length;

            for (var i = 0; i < resultsLength; i++) {
                var resultNode = results[i];
                var rank = MadCap.Dom.GetAttributeInt(resultNode, "Rank", -1);
                var title = resultNode.getAttribute("Title");
                var link = resultNode.getAttribute("Link");
                var abstractText = resultNode.getAttribute("AbstractText");

                if (MadCap.String.IsNullOrEmpty(title))
                    title = resultNode.getAttribute("Filename");

                var searchResult = new Search.SearchResult(rank, title, link, unescape(abstractText));

                resultSet.Add(searchResult);
            }

            //

            OnCompleteFunc(resultSet);
        }

        MadCap.Utilities.Xhr.CallWebService("Service/Service.asmx/GetSearchResults?SearchString=" + encodeURIComponent(searchQuery) + "&FilterName=" + encodeURIComponent(filterName), true, OnGetSearchResultsComplete, null);

        var searchTerms = searchQuery.split(" ");
        var firstStem = true;

        this._Highlight = "?Highlight=";

        for (var i = 0; i < searchTerms.length; i++) {
            if (!firstStem)
                this._Highlight += "||";
            else
                firstStem = false;

            this._Highlight += searchTerms[i];
        }
    };

    var Search = MadCap.CreateNamespace("WebHelp.Search");

    //
    //    Class SearchDB
    //

    MadCap.WebHelp.Search.SearchDB = function (helpSystem) {
        // Public properties

        this.URLSources = new Array();
        this.URLTitles = new Array();
        this.URLAbstracts = new Array();
        this.SearchDB = new MadCap.Utilities.Dictionary();
        this.HelpSystem = helpSystem;
        this.SearchType = null;
        this.NGramSize = 0;
        this.SynonymFile = null;
        this.DownloadedSynonymFile = null;
        this.LoadChunkCompleteFuncs = new MadCap.Utilities.Dictionary();
    };

    var SearchDB = Search.SearchDB;

    SearchDB.prototype.Load = function (dbFile, OnCompleteFunc) {
        MadCap.Utilities.Xhr.Load(this.HelpSystem.GetPath() + "Data/Synonyms.xml", true, function (xmlDoc) {
            if (xmlDoc != null) {
                this.SynonymFile = new Search.SynonymFile(xmlDoc.documentElement);
            }

            this._LoadSearchDB(this.HelpSystem.GetPath() + dbFile, OnCompleteFunc);
        }, null, this);
    };

    SearchDB.prototype.LookupPhrases = function (stem, phrases) {
        var stemMap = this.SearchDB.GetItem(stem);

        if (stemMap) {
            stemMap.ForEach(function (key, value) {
                phrases.Add(key, true);

                return true;
            });
        }
    };

    SearchDB.prototype.LookupStem = function (resultSet, stem, dbIndex, buildWordMap, buildPhraseMap) {
        var stemMap = this.SearchDB.GetItem(stem);

        if (stemMap) {
            stemMap.ForEach(function (key, value) {
                var phraseXMLNode = value;

                for (var i = 0, length = phraseXMLNode.length; i < length; i++) {
                    var entry = phraseXMLNode[i];
                    var result = new Search.QueryResult(dbIndex, entry, entry.Rank, key);

                    resultSet.Add(result, buildWordMap, buildPhraseMap, false);
                }

                return true;
            });
        }
    };

    // Private functions

    SearchDB.prototype._LoadSearchDB = function (dbFile, OnCompleteFunc) {
        MadCap.Utilities.Xhr.Load(dbFile, true, function (xmlDoc) {
            var urls = MadCap.Dom.GetChildNodeByTagName(xmlDoc.documentElement, "urls", 0).getElementsByTagName("Url");
            var stems = xmlDoc.getElementsByTagName("stem");
            var root = xmlDoc.documentElement;

            this.SearchType = root.getAttribute("SearchType");
            this.NGramSize = parseInt(MadCap.Dom.GetAttribute(root, "NGramSize", 0));

            // Load URLs

            for (var i = 0; i < urls.length; i++) {
                var url = urls[i];

                this.URLSources[i] = MadCap.Dom.GetAttribute(url, "Source");
                this.URLTitles[i] = MadCap.Dom.GetAttribute(url, "Title");
                this.URLAbstracts[i] = MadCap.Dom.GetAttribute(url, "Abstract");
            }

            // Load stems

            for (var i = 0; i < stems.length; i++) {
                var stem = stems[i];
                var stemName = stem.getAttribute("n");
                var chunk = stem.getAttribute("chunk");

                if (chunk) {
                    this.SearchDB.Add(stemName, chunk);
                }
                else {
                    var phrases = stem.getElementsByTagName("phr");
                    var phraseMap = new MadCap.Utilities.Dictionary();

                    this.SearchDB.Add(stemName, phraseMap);

                    // Load phrases

                    for (var j = 0; j < phrases.length; j++) {
                        var phrase = phrases[j];
                        var phraseName = phrase.getAttribute("n");
                        var entries = phrase.getElementsByTagName("ent");
                        var entriesArray = new Array(entries.length);

                        phraseMap.Add(phraseName, entriesArray);

                        // Load entries

                        for (var k = 0; k < entries.length; k++) {
                            var phraseNode = entries[k];
                            var r = parseInt(phraseNode.getAttribute("r"));
                            var t = parseInt(phraseNode.getAttribute("t"));
                            var w = parseInt(phraseNode.getAttribute("w"));
                            var entry = new Search.Entry(r, t, w);

                            entriesArray[k] = entry;
                        }
                    }
                }
            }

            OnCompleteFunc();
        }, null, this);
    };

    SearchDB.prototype.LoadChunk = function (stem, OnCompleteFunc) {
        var item = this.SearchDB.GetItem(stem);

        if (typeof item == "string") {
            var loadFuncs = this.LoadChunkCompleteFuncs.GetItem(item);
            if (loadFuncs != null)
                loadFuncs.push(OnCompleteFunc);
            else {
                loadFuncs = [OnCompleteFunc];
                this.LoadChunkCompleteFuncs.Add(item, loadFuncs);

                MadCap.Utilities.Xhr.Load(this.HelpSystem.GetPath() + "Data/" + item, true, function (xmlDoc) {
                    var stems = xmlDoc.getElementsByTagName("stem");

                    // Load stems

                    for (var i = 0; i < stems.length; i++) {
                        var stem = stems[i];
                        var stemName = stem.getAttribute("n");
                        var phrases = stem.getElementsByTagName("phr");
                        var phraseMap = new MadCap.Utilities.Dictionary();

                        this.SearchDB.Add(stemName, phraseMap);

                        // Load phrases

                        for (var j = 0; j < phrases.length; j++) {
                            var phrase = phrases[j];
                            var phraseName = phrase.getAttribute("n");
                            var entries = phrase.getElementsByTagName("ent");
                            var entriesArray = new Array(entries.length);

                            phraseMap.Add(phraseName, entriesArray);

                            // Load entries

                            for (var k = 0; k < entries.length; k++) {
                                var phraseNode = entries[k];
                                var r = parseInt(phraseNode.getAttribute("r"));
                                var t = parseInt(phraseNode.getAttribute("t"));
                                var w = parseInt(phraseNode.getAttribute("w"));
                                var entry = new Search.Entry(r, t, w);

                                entriesArray[k] = entry;
                            }
                        }
                    }

                    for (var i = 0; i < loadFuncs.length; i++)
                        loadFuncs[i]();

                    this.LoadChunkCompleteFuncs.Remove(item);
                }, null, this);
            }
        }
        else {
            OnCompleteFunc();
        }
    };

    //
    //    End class SearchDB
    //

    //
    //    Class SearchResult
    //

    Search.SearchResult = function (rank, title, link, abstractText) {
        // Public properties

        this.Rank = rank;
        this.Title = title;
        this.Link = link;
        this.AbstractText = abstractText
    };

    //
    //    End class SearchResult
    //

    //
    //    Class SearchResultSet
    //

    Search.SearchResultSet = function () {
        // Public properties

        this._Results = new Array();
    };

    var SearchResultSet = Search.SearchResultSet;

    SearchResultSet.prototype.Add = function (searchResult) {
        this._Results[this._Results.length] = searchResult;
    };

    SearchResultSet.prototype.GetResult = function (index) {
        return this._Results[index];
    };

    SearchResultSet.prototype.GetLength = function () {
        return this._Results.length;
    };

    //
    //    End class SearchResultSet
    //

    //
    //    Class Filters
    //

    Search.Filters = function (helpSystem) {
        // Private member variables

        var _HelpSystem = helpSystem;

        // Public member functions

        this.Load = function (OnCompleteFunc) {
            _HelpSystem.LoadMergedSearchFilters(function (filterMap) {
                _HelpSystem.LoadAllConcepts(function () {
                    OnCompleteFunc();
                });
            }, null, null);
        };

        this.ApplyFilter = function (resultSet, filterName) {
            if (!resultSet) {
                return null;
            }

            var filteredSet = new Search.QueryResultSet();

            if (filterName == null) {
                for (var i = 0, length = resultSet.GetLength(); i < length; i++) {
                    filteredSet.Add(resultSet.GetResult(i), false, false, false);
                }
            }
            else {
                for (var i = 0, length = resultSet.GetLength(); i < length; i++) {
                    var result = resultSet.GetResult(i);
                    var searchDBIndex = result.SearchDB;
                    var searchDB = SearchPane.SearchDBs[searchDBIndex];
                    var topicID = parseInt(result.Entry.TopicID);
                    var topicPath = searchDB.URLSources[topicID];
                    var topicFile = searchDB.HelpSystem.GetPath() + topicPath.substring("../".length, topicPath.length);
                    var filterMap = searchDB.HelpSystem.GetSearchFilters();

                    if (filterMap == null)
                        continue;

                    var concepts = filterMap.GetItem(filterName);

                    // filter doesn't exist in this project (came from a merged project)
                    if (concepts == null)
                        continue;

                    var conceptMap = searchDB.HelpSystem.GetConcepts();

                    concepts.ForEach(function (key, value) {
                        var conceptLinkList = conceptMap.GetItem(key);

                        if (conceptLinkList != null) {
                            for (var j = 0, length2 = conceptLinkList.length; j < length2; j++) {
                                var conceptLink = new MadCap.Utilities.Url(conceptLinkList[j].Link);

                                if (conceptLink.PlainPath == topicFile) {
                                    filteredSet.Add(result, false, false, false);

                                    return false;
                                }
                            }
                        }

                        return true;
                    });
                }
            }

            return filteredSet;
        };
    };

    //
    //    End class Filters
    //

    //
    //    Class SynonymFile
    //

    Search.SynonymFile = function (rootNode) {
        // Public properties

        this.WordToStem = new MadCap.Utilities.Dictionary();
        this.Directionals = new MadCap.Utilities.Dictionary();
        this.DirectionalStems = new MadCap.Utilities.Dictionary();
        this.DirectionalStemSources = new MadCap.Utilities.Dictionary();
        this.Groups = new MadCap.Utilities.Dictionary();
        this.GroupStems = new MadCap.Utilities.Dictionary();
        this.GroupStemSources = new MadCap.Utilities.Dictionary();

        this.LoadSynonymFile(rootNode);
    };

    var SynonymFile = Search.SynonymFile;

    SynonymFile.prototype.LoadSynonymFile = function (rootNode) {
        var groups = MadCap.Dom.GetChildNodeByTagName(rootNode, "Groups", 0);
        var syns = MadCap.Dom.GetChildNodeByTagName(rootNode, "Directional", 0);

        if (syns != null) {
            var childNodesLength = syns.childNodes.length;

            for (var i = 0; i < childNodesLength; i++) {
                var child = syns.childNodes[i];

                if (child.nodeName == "DirectionalSynonym") {
                    var from = MadCap.Dom.GetAttribute(child, "From");
                    var to = MadCap.Dom.GetAttribute(child, "To");
                    var stem = MadCap.Dom.GetAttributeBool(child, "Stem", false);
                    var fromStem = MadCap.Dom.GetAttribute(child, "FromStem");
                    var toStem = MadCap.Dom.GetAttribute(child, "ToStem");

                    if (stem) {
                        if (fromStem == null) {
                            fromStem = Search.Stemmer(from);
                        }
                    }

                    if (toStem == null) {
                        toStem = Search.Stemmer(to);
                    }

                    if (from != null && to != null) {
                        if (stem) {
                            this.DirectionalStemSources.Add(from, toStem);
                            this.DirectionalStems.Add(fromStem, toStem);

                            this.WordToStem.Add(from, fromStem);
                            this.WordToStem.Add(to, toStem);
                        }
                        else {
                            this.Directionals.Add(from, toStem);

                            this.WordToStem.Add(to, toStem);
                        }
                    }
                }
            }
        }

        if (groups != null) {
            var childNodesLength = groups.childNodes.length;

            for (var i = 0; i < childNodesLength; i++) {
                var child = groups.childNodes[i];

                if (child.nodeName == "SynonymGroup") {
                    var words = new Array();
                    var stemmedWords = new Array();
                    var stem = MadCap.Dom.GetAttributeBool(child, "Stem", false);

                    var synGroupChildNodesLength = child.childNodes.length;

                    for (var j = 0; j < synGroupChildNodesLength; j++) {
                        var wordNode = child.childNodes[j];

                        if (wordNode.nodeType != 1) {
                            continue;
                        }

                        words.push(wordNode.firstChild.nodeValue);
                    }

                    for (var j = 0; j < synGroupChildNodesLength; j++) {
                        var wordNode = child.childNodes[j];

                        if (wordNode.nodeType != 1) {
                            continue;
                        }

                        var stemmed = MadCap.Dom.GetAttribute(wordNode, "Stem");

                        if (stemmed == null) {
                            stemmed = Search.Stemmer(wordNode.firstChild.nodeValue);
                        }

                        this.WordToStem.Add(wordNode.firstChild.nodeValue, stemmed);

                        stemmedWords.push(stemmed);
                    }


                    //

                    var wordsLength = words.length;

                    for (var j = 0; j < wordsLength; j++) {
                        var word = words[j];
                        var stemmedWord = stemmedWords[j];

                        for (var k = 0; k < wordsLength; k++) {
                            var word1 = words[k];

                            if (stem) {
                                var group = this.GroupStemSources.GetItem(word);

                                if (group == null) {
                                    group = new MadCap.Utilities.Dictionary();
                                    this.GroupStemSources.Add(word, group);
                                }

                                group.Add(word1, stemmedWord);
                            }
                            else {
                                var group = this.GroupStemSources.GetItem(word);

                                if (group == null) {
                                    group = new MadCap.Utilities.Dictionary();
                                    this.Groups.Add(word, group);
                                }

                                group.Add(word1, stemmedWord);
                            }
                        }
                    }

                    //

                    var stemmedWordsLength = stemmedWords.length;

                    for (var j = 0; j < stemmedWordsLength; j++) {
                        var stemmedWord = stemmedWords[j];

                        for (var k = 0; k < stemmedWordsLength; k++) {
                            var stemmedWord1 = stemmedWords[k];
                            var group = this.GroupStems.GetItem(stemmedWord);

                            if (group == null) {
                                group = new MadCap.Utilities.Dictionary();
                                this.GroupStems.Add(stemmedWord, group);
                            }

                            group.Add(stemmedWord1, stemmedWord);
                        }
                    }
                }
            }
        }
    };

    SynonymFile.prototype.AddSynonymStems = function (term, termStem, stems) {
        var synonym = this.Directionals.GetItem(term);

        if (synonym != null) {
            stems.AddUnique(synonym);
        }

        //

        synonym = this.DirectionalStems.GetItem(termStem);

        if (synonym != null) {
            stems.AddUnique(synonym);
        }

        var group = this.Groups.GetItem(term);

        if (group != null) {
            group.ForEach(function (key, value) {
                stems.AddUnique(key);

                return true;
            });
        }

        //

        group = this.GroupStems.GetItem(termStem);

        if (group != null) {
            group.ForEach(function (key, value) {
                stems.AddUnique(key);

                return true;
            });
        }
    };

    //
    //    End class SynonymFile
    //
})();
