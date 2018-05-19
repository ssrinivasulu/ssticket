/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapXhr.js" />
/// <reference path="MadCapHelpSystem.js" />
/// <reference path="MadCapStemmer.js" />

/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
*
* v10.0.0.0
*/

(function () {
    if (MadCap.Dom.Dataset(document.documentElement, "mcRuntimeFileType") != "Default")
        return;

    var Search = MadCap.CreateNamespace("WebHelp.Search");

    //
    //    Class Tokenizer
    //

    Search.Tokenizer = function () {
        // Private variables

        var mOriginalString = "";
        var mPos = -1;
        var mTokens = new Array();

        // Public functions

        this.Tokenize = function (str) {
            var token = null;

            mOriginalString = str;
            mPos = -1;

            for (var i = 0; token = ReadNextToken(); i++) {
                mTokens[i] = token;
            }

            return mTokens;
        }

        // Private functions

        function IsNameChar(c) {
            if (!c) { return false; }
            else if (c == "\"") { return false; }
            else if (c == "+") { return false; }
            else if (c == "^") { return false; }
            else if (c == "|") { return false; }
            else if (c == "&") { return false; }
            else if (c == "(") { return false; }
            else if (c == ")") { return false; }
            else if (IsWhiteSpace(c)) { return false; }
            else { return true; }
        }

        function IsWhiteSpace(c) {
            if (!c) {
                return false;
            }
            else if (c == " ") {
                return true;
            }
            else if (c.charCodeAt(0) == 12288) {
                return true;
            }
            else {
                return false;
            }
        }

        function Peek() {
            return mOriginalString.charAt(mPos + 1);
        }

        function Read() {
            mPos++;
        }

        function ReadString() {
            var str = "";

            for (; ; ) {
                var c = Peek();

                if (!c) {
                    return (str == "") ? null : str;
                }

                if (c == "\\") {
                    Read();

                    if (!Peek()) {
                        return null;
                    }

                    Read();

                    continue;
                }

                if (c == "\"") {
                    Read();

                    break;
                }
                else {
                    Read();
                    str += c;
                }
            }

            return str;
        }

        function ReadNextToken() {
            var c = Peek();
            var token = null;
            var tokenText = "";

            if (!c) {
                token = null;
            }
            else if (IsWhiteSpace(c)) {
                for (c = Peek(); IsWhiteSpace(c); c = Peek()) {
                    Read();
                    tokenText += c;
                }

                token = new Search.Token(tokenText, Search.Token.WhiteSpace);
            }
            else if (c == "(") {
                Read();
                token = new Search.Token(c, Search.Token.LeftParen);
            }
            else if (c == ")") {
                Read();
                token = new Search.Token(c, Search.Token.RightParen);
            }
            else if (c == "^") {
                Read();
                token = new Search.Token(c, Search.Token.Subtract);
            }
            else if (c == "+" || c == "&") {
                Read();
                token = new Search.Token(c, Search.Token.And);
            }
            else if (c == "|") {
                Read();
                token = new Search.Token(c, Search.Token.Or);
            }
            else if (c == "!") {
                Read();
                token = new Search.Token(c, Search.Token.Not);
            }
            else if (c == "\"") {
                Read();

                var str = ReadString();

                if (MadCap.String.Contains(str, Search.Tokenizer.Connectors)) {
                    str = str.replace(Search.Tokenizer.ConnectorRegex, " ");
                    str = $.trim(str);
                }

                token = new Search.Token(str, (str == null) ? Search.Token.Error : Search.Token.Phrase);
            }
            else {
                for (c = Peek(); IsNameChar(c); c = Peek()) {
                    Read();
                    tokenText += c;
                }

                if (tokenText == "and" || tokenText == "AND") {
                    token = new Search.Token(tokenText, Search.Token.And);
                }
                else if (tokenText == "or" || tokenText == "OR") {
                    token = new Search.Token(tokenText, Search.Token.Or);
                }
                else if (tokenText == "not" || tokenText == "NOT") {
                    token = new Search.Token(tokenText, Search.Token.Not);
                }
                else {
                    var tokenType = Search.Token.Word;

                    if (MadCap.WebHelp.SearchPane.SearchDBs[0].SearchType == "NGram") {
                        tokenType = Search.Token.Phrase;
                    }

                    if (MadCap.String.Contains(tokenText, Search.Tokenizer.Connectors)) {
                        tokenText = tokenText.replace(Search.Tokenizer.ConnectorRegex, " ");
                        tokenText = $.trim(tokenText);
                        token = new Search.Token(tokenText, Search.Token.Phrase);
                    }
                    else {
                        token = new Search.Token(tokenText, tokenType);
                    }
                }
            }

            return token;
        }
    };

    Search.Tokenizer.Connectors = [".", ",", "'", "/", ":", ";", "\\", "-", "*", "<", ">", "!", "@"];
    Search.Tokenizer.ConnectorRegex = new RegExp("[" + Search.Tokenizer.Connectors.join("") + "]", "g");

    //
    //    End class Tokenizer
    //

    //
    //    Class Token
    //

    Search.Token = function (tokenText, type) {
        // Private member variables

        var mTokenText = tokenText;
        var mType = type;

        // Public member functions

        this.GetTokenText = function () {
            return mTokenText;
        };

        this.GetType = function () {
            return mType;
        };
    };

    var Token = Search.Token;

    // Static properties

    Token.Eof = 0;
    Token.Error = 1;
    Token.WhiteSpace = 2;
    Token.Phrase = 3;
    Token.Word = 4;
    Token.RightParen = 5;
    Token.LeftParen = 6;
    Token.Not = 7;
    Token.Subtract = 8;
    Token.And = 9;
    Token.Or = 10;
    Token.ImplicitOr = 11;

    //
    //    End class Token
    //

    //
    //    Class Parser
    //

    Search.Parser = function (str) {
        // Private member variables

        var mSelf = this;
        var mSearchString = str;
        var mCurrentToken = -1;
        var mTokenizer = new Search.Tokenizer();
        var mSearchTokens = mTokenizer.Tokenize(mSearchString);

        // Public member functions

        this.GetStemMap = function (OnCompleteFunc) {
            function OnLoadChunkComplete() {
                completed++;

                if (completed == length) {
                    for (var i = 0; i < mSearchTokens.length; i++) {
                        var token = mSearchTokens[i];

                        if (token.GetType() == Search.Token.Word) {
                            var term = token.GetTokenText();
                            var phrases = new MadCap.Utilities.Dictionary();

                            stemMap.Add(term, phrases);

                            for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                                var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                                if (searchDB.SearchType == "NGram") {
                                    for (var k = 0; k < term.length - searchDB.NGramSize + 1; k++) {
                                        var subText = term.substring(k, k + searchDB.NGramSize);
                                        var stem = Search.Stemmer(subText);

                                        searchDB.LookupPhrases(stem, phrases);
                                    }
                                }
                                else {
                                    var stem = Search.Stemmer(term);

                                    searchDB.LookupPhrases(stem, phrases);
                                }
                            }
                        }
                        else if (token.GetType() == Search.Token.Phrase) {
                            var term = token.GetTokenText();
                            var phrases = new MadCap.Utilities.Dictionary();

                            phrases.Add(term, true);
                            stemMap.Add(term, phrases);
                        }
                    }

                    OnCompleteFunc(stemMap);
                }
            }

            var completed = 0;
            var length = 0;

            //

            var stemMap = new MadCap.Utilities.Dictionary();

            // Calculate "length"
            for (var i = 0; i < mSearchTokens.length; i++) {
                var token = mSearchTokens[i];

                if (token.GetType() == Search.Token.Word) {
                    var term = token.GetTokenText();

                    for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                        if (searchDB.SearchType == "NGram") {
                            for (var k = 0; k < term.length - searchDB.NGramSize + 1; k++) {
                                length++;
                            }
                        }
                        else {
                            length++;
                        }
                    }
                }
                else if (token.GetType() == Search.Token.Phrase) {
                    length++;
                }
            }

            // Load all the chunks first
            for (var i = 0; i < mSearchTokens.length; i++) {
                var token = mSearchTokens[i];

                if (token.GetType() == Search.Token.Word) {
                    var term = token.GetTokenText();

                    for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                        if (searchDB.SearchType == "NGram") {
                            for (var k = 0; k < term.length - searchDB.NGramSize + 1; k++) {
                                var subText = term.substring(k, k + searchDB.NGramSize);
                                var stem = Search.Stemmer(subText);

                                searchDB.LoadChunk(stem, OnLoadChunkComplete);
                            }
                        }
                        else {
                            var stem = Search.Stemmer(term);

                            searchDB.LoadChunk(stem, OnLoadChunkComplete);
                        }
                    }
                }
                else if (token.GetType() == Search.Token.Phrase) {
                    OnLoadChunkComplete();
                }
            }
        };

        this.ParseExpression = function () {
            var node = ParseUnary();

            SkipWhiteSpace();

            if (Peek() == Search.Token.Eof) {
                return node;
            }
            else if (Peek() == Search.Token.And || Peek() == Search.Token.Or || Peek() == Search.Token.Subtract) {
                EatToken();

                var binNode = new Search.Node(mSearchTokens[mCurrentToken],
                                       node,
                                       this.ParseExpression());

                return binNode;
            }
            else if (Peek() == Search.Token.Word || Peek() == Search.Token.Phrase || Peek() == Search.Token.Not || Peek() == Search.Token.LeftParen) {
                var binNode = new Search.Node(new Search.Token(node.GetToken().GetTokenText() + " " + mSearchTokens[mCurrentToken + 1].GetTokenText(), Search.Token.ImplicitOr),
                                       node,
                                       this.ParseExpression());

                return binNode;
            }
            else if (Peek() == Search.Token.RightParen) {
                return node;
            }

            throw gInvalidTokenLabel;
        };

        // Private member functions

        function EatToken() {
            mCurrentToken++;
        }

        function ParseUnary() {
            SkipWhiteSpace();

            if (Peek() == Search.Token.Word) {
                EatToken();

                return new Search.Node(mSearchTokens[mCurrentToken], null, null);
            }
            else if (Peek() == Search.Token.Phrase) {
                EatToken();

                return new Search.Node(mSearchTokens[mCurrentToken], null, null);
            }
            else if (Peek() == Search.Token.Not) {
                EatToken();

                return new Search.Node(mSearchTokens[mCurrentToken],
                                ParseUnary(),
                                null);
            }
            else if (Peek() == Search.Token.LeftParen) {
                EatToken();

                var token = mSearchTokens[mCurrentToken];
                var node = new Search.Node(token, mSelf.ParseExpression(), null);

                if (Peek() != Search.Token.RightParen) {
                    throw "Missing right paren ')'.";
                }

                EatToken();

                return node;
            }

            throw gInvalidTokenLabel;
        }

        function Peek() {
            if (mSearchTokens[mCurrentToken + 1] == null) {
                return Search.Token.Eof;
            }
            else {
                return mSearchTokens[mCurrentToken + 1].GetType();
            }
        }

        function SkipWhiteSpace() {
            for (; Peek() == Search.Token.WhiteSpace; ) {
                EatToken();
            }
        }
    };

    //
    //    End class Parser
    //

    //
    //    Class Node
    //

    Search.Node = function (token, op1, op2) {
        // Private member variables

        var mToken = token;
        var mOperand1 = op1;
        var mOperand2 = op2;

        // Public member functions

        this.Evaluate = function (buildWordMap, buildPhraseMap, OnCompleteFunc) {
            var tokenType = mToken.GetType();

            if (tokenType == Search.Token.Word) {
                this.EvaluateWord(buildWordMap, buildPhraseMap, OnCompleteFunc);

                return;
            }
            else if (tokenType == Search.Token.Phrase) {
                this.EvaluatePhrase(buildWordMap, buildPhraseMap, OnCompleteFunc);

                return;
            }
            else if (tokenType == Search.Token.And ||
				  tokenType == Search.Token.ImplicitOr ||
				  tokenType == Search.Token.Or ||
				  tokenType == Search.Token.Subtract) {
                var needWordMap = mToken.GetType() == Search.Token.ImplicitOr;
                var needPhraseMap = mToken.GetType() == Search.Token.ImplicitOr || mToken.GetType() == Search.Token.Or;

                mOperand1.Evaluate(needWordMap, needPhraseMap, function (leftResults) {
                    mOperand2.Evaluate(false, false, function (rightResults) {
                        if (mToken.GetType() == Search.Token.And) {
                            OnCompleteFunc(leftResults.ToIntersection(rightResults, buildWordMap, buildPhraseMap));
                        }
                        else if (mToken.GetType() == Search.Token.ImplicitOr) {
                            rightResults.PromotePhrases(leftResults, mToken);
                            leftResults.ToUnion(rightResults, buildWordMap, buildPhraseMap);

                            OnCompleteFunc(leftResults);
                        }
                        else if (mToken.GetType() == Search.Token.Or) {
                            leftResults.ToUnion(rightResults, buildWordMap, buildPhraseMap);

                            OnCompleteFunc(leftResults);
                        }
                        else if (mToken.GetType() == Search.Token.Subtract) {
                            OnCompleteFunc(leftResults.ToDifference(rightResults, buildWordMap, buildPhraseMap));
                        }
                    });
                });

                return;
            }
            else if (tokenType == Search.Token.LeftParen) {
                if (mOperand1) {
                    mOperand1.Evaluate(buildWordMap, buildPhraseMap, OnCompleteFunc);

                    return;
                }

                OnCompleteFunc(new Search.QueryResultSet());

                return;
            }
            else if (tokenType == Search.Token.Not) {
                function OnEvaluateOperand1Complete(resultSet) {
                    var val = resultSet;
                    var results = new Search.QueryResultSet();

                    for (var i = 0; i < MadCap.WebHelp.SearchPane.SearchDBs.length; i++) {
                        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[i];

                        for (var j = 0; j < searchDB.URLSources.length; j++) {
                            var found = false;
                            var currResult = null;

                            for (var k = 0; k < val.GetLength(); k++) {
                                currResult = val.GetResult(k);

                                if (currResult.Entry.TopicID == j && currResult.SearchDB == i) {
                                    found = true;
                                    break;
                                }
                            }

                            if (!found) {
                                var entry = new Search.Entry(0, j, -1);
                                var result = new Search.QueryResult(i, entry, 0, null);

                                results.Add(result, buildWordMap, buildPhraseMap, false);
                            }
                        }
                    }

                    OnCompleteFunc(results);
                }

                if (mOperand1) {
                    mOperand1.Evaluate(buildWordMap, buildPhraseMap, OnEvaluateOperand1Complete);
                }
                else {
                    OnEvaluateOperand1Complete(new Search.QueryResultSet());
                }

                return;
            }
        };

        this.EvaluateWord = function (buildWordMap, buildPhraseMap, OnCompleteFunc) {
            function OnLoadChunkComplete() {
                completed++;

                if (completed == length) {
                    stems.ForEach(function (key, value) {
                        for (var i = 0; i < MadCap.WebHelp.SearchPane.SearchDBs.length; i++) {
                            var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[i];

                            if (searchDB.SearchType == "NGram") {
                                for (var j = 0; j < key.length - searchDB.NGramSize + 1; j++) {
                                    var subText = key.substring(j, j + searchDB.NGramSize);

                                    searchDB.LookupStem(resultSet, subText, i, buildWordMap, buildPhraseMap);
                                }
                            }
                            else {
                                searchDB.LookupStem(resultSet, key, i, buildWordMap, buildPhraseMap);
                            }

                            for (var j = 0, resultSetLength = resultSet.GetLength(); j < resultSetLength; j++) {
                                var result = resultSet.GetResult(j);

                                if (result.ParentPhraseName == tokenText) {
                                    result.Ranking = result.Ranking + 1000;
                                }
                                else if (result.ParentPhraseName.toLowerCase() == tokenText.toLowerCase()) {
                                    result.Ranking = result.Ranking + 500;
                                }

                                //

                                if (stems.GetLength() > 0 && stemk == 0) {
                                    result.Ranking = result.Ranking + 50; // If synonyms are used, give the original stem a little higher ranking
                                }
                            }

                            stemk++;
                        }

                        return true;
                    });

                    OnCompleteFunc(resultSet);
                }
            }

            var completed = 0;
            var length = 0;

            //

            var tokenText = mToken.GetTokenText();

            //

            var stems = new MadCap.Utilities.Dictionary();
            var startStem = Search.Stemmer(tokenText);

            stems.Add(tokenText, true);
            stems.Add(startStem, true);

            for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                if (searchDB.SynonymFile != null) {
                    searchDB.SynonymFile.AddSynonymStems(tokenText, startStem, stems);
                }

                if (searchDB.DownloadedSynonymFile != null) {
                    searchDB.DownloadedSynonymFile.AddSynonymStems(tokenText, startStem, stems);
                }
            }

            //

            var resultSet = new Search.QueryResultSet();

            var stemk = 0;

            // Calculate "length"
            stems.ForEach(function (key, value) {
                for (var i = 0; i < MadCap.WebHelp.SearchPane.SearchDBs.length; i++) {
                    var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[i];

                    if (searchDB.SearchType == "NGram") {
                        for (var j = 0; j < key.length - searchDB.NGramSize + 1; j++) {
                            length++;
                        }
                    }
                    else {
                        length++;
                    }
                }

                return true;
            });

            // Load all the chunks first
            stems.ForEach(function (key, value) {
                for (var i = 0; i < MadCap.WebHelp.SearchPane.SearchDBs.length; i++) {
                    var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[i];

                    if (searchDB.SearchType == "NGram") {
                        for (var j = 0; j < key.length - searchDB.NGramSize + 1; j++) {
                            var subText = key.substring(j, j + searchDB.NGramSize);

                            searchDB.LoadChunk(subText, OnLoadChunkComplete);
                        }
                    }
                    else {
                        searchDB.LoadChunk(key, OnLoadChunkComplete);
                    }
                }

                return true;
            });
        };

        this.EvaluatePhrase = function (buildWordMap, buildPhraseMap, OnCompleteFunc) {
            function OnLoadChunkComplete() {
                completed++;

                if (completed == length) {
                    for (var i = 0; i < terms.length; i++) {
                        var term = terms[i];
                        var resultSet2 = new Search.QueryResultSet();

                        //

                        var stems = new MadCap.Utilities.Dictionary();
                        var startStem = Search.Stemmer(term);

                        stems.Add(startStem, true);

                        //

                        stems.ForEach(function (key, value) {
                            for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                                var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                                if (searchDB.SearchType == "NGram") {
                                    for (var k = 0; k < key.length - searchDB.NGramSize + 1; k++) {
                                        var subText = key.substring(k, k + searchDB.NGramSize);

                                        searchDB.LookupStem(resultSet2, subText, j, true, buildPhraseMap);
                                    }
                                }
                                else {
                                    searchDB.LookupStem(resultSet2, key, j, true, buildPhraseMap);
                                }
                            }

                            return true;
                        });

                        if (!resultSet) {
                            resultSet = resultSet2;
                            continue;
                        }

                        var newResultSet = resultSet.ToPhrases(resultSet2, mToken, true, buildPhraseMap);

                        if (newResultSet.GetLength() == 0) {
                            OnCompleteFunc(newResultSet);
                            return;
                        }

                        resultSet = newResultSet;
                    }

                    if (!resultSet) {
                        resultSet = new Search.QueryResultSet();
                    }

                    OnCompleteFunc(resultSet);
                }
            }

            var completed = 0;
            var length = 0;

            //

            var tokenText = mToken.GetTokenText();
            var terms = Search.SplitPhrase(tokenText);
            var resultSet = null;

            for (var i = 0; i < terms.length; i++) {
                var term = terms[i];

                //

                var stems = new MadCap.Utilities.Dictionary();
                var startStem = Search.Stemmer(term);

                stems.Add(startStem, true);

                for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                    var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                    if (searchDB.SynonymFile != null) {
                        searchDB.SynonymFile.AddSynonymStems(tokenText, startStem, stems);
                    }

                    if (searchDB.DownloadedSynonymFile != null) {
                        searchDB.DownloadedSynonymFile.AddSynonymStems(tokenText, startStem, stems);
                    }
                }
            }

            // Calculate "length"
            for (var i = 0; i < terms.length; i++) {
                var term = terms[i];

                //

                var stems = new MadCap.Utilities.Dictionary();
                var startStem = Search.Stemmer(term);

                stems.Add(startStem, true);

                stems.ForEach(function (key, value) {
                    for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                        if (searchDB.SearchType == "NGram") {
                            for (var k = 0; k < key.length - searchDB.NGramSize + 1; k++) {
                                length++;
                            }
                        }
                        else {
                            length++;
                        }
                    }

                    return true;
                });
            }

            // Load all the chunks first
            for (var i = 0; i < terms.length; i++) {
                var term = terms[i];

                //

                var stems = new MadCap.Utilities.Dictionary();
                var startStem = Search.Stemmer(term);

                stems.Add(startStem, true);

                stems.ForEach(function (key, value) {
                    for (var j = 0; j < MadCap.WebHelp.SearchPane.SearchDBs.length; j++) {
                        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[j];

                        if (searchDB.SearchType == "NGram") {
                            for (var k = 0; k < key.length - searchDB.NGramSize + 1; k++) {
                                var subText = key.substring(k, k + searchDB.NGramSize);

                                searchDB.LoadChunk(subText, OnLoadChunkComplete);
                            }
                        }
                        else {
                            searchDB.LoadChunk(key, OnLoadChunkComplete);
                        }
                    }

                    return true;
                });
            }
        };

        this.GetToken = function () {
            return mToken;
        };
    };

    //
    //    End class Node
    //

    //
    //    Class Entry
    //

    Search.Entry = function (rank, topicID, word) {
        // Private member variables

        this.Rank = rank;
        this.TopicID = topicID;
        this.Word = word;
    };

    //
    //    End class Entry
    //

    //
    //    Class QueryResult
    //

    Search.QueryResult = function (dbIndex, entry, rank, parentPhraseName) {
        // Public properties

        this.SearchDB = dbIndex;
        this.Entry = entry;
        this.Ranking = rank;
        this.ParentPhraseName = parentPhraseName;
    };

    //
    //    End class QueryResult
    //

    //
    //    Class QueryResultSet
    //

    Search.QueryResultSet = function () {
        // Public properties

        this.mResults = new Array();
        this.mWordMap = new MadCap.Utilities.Dictionary();
        this.mPhraseMap = new MadCap.Utilities.Dictionary();
        this.mTopicMap = new MadCap.Utilities.Dictionary();
    };

    var QueryResultSet = Search.QueryResultSet;

    QueryResultSet.prototype.Add = function (result, buildWordMap, buildPhraseMap, buildTopicMap) {
        this.mResults[this.mResults.length] = result;

        var searchDB = result.SearchDB;
        var entry = result.Entry;

        if (buildWordMap) {
            var key = searchDB + "_" + entry.TopicID + "_" + entry.Word;

            this.mWordMap.Add(key, result);
        }

        if (buildPhraseMap) {
            var key = result.ParentPhraseName + "_" + searchDB + "_" + entry.TopicID + "_" + entry.Word;

            this.mPhraseMap.Add(key, true);
        }

        if (buildTopicMap) {
            var key = searchDB + "_" + entry.TopicID;
            var indexList = this.mTopicMap.GetItem(key);

            if (!indexList) {
                indexList = new Array();
                this.mTopicMap.Add(key, indexList);
            }

            indexList[indexList.length] = this.mResults.length - 1;
        }
    };

    QueryResultSet.prototype.AddAllUnique = function (results, buildWordMap, buildPhraseMap) {
        var count = results.GetLength();

        for (var i = 0; i < count; i++) {
            var result = results.GetResult(i);
            var entry = result.Entry;
            var searchDB = result.SearchDB;
            var phrase = result.ParentPhraseName;
            var rank = entry.Rank;
            var topic = entry.TopicID;
            var word = entry.Word;
            var key = phrase + "_" + searchDB + "_" + topic + "_" + word;

            if (this.mPhraseMap.GetItem(key)) {
                continue;
            }

            this.Add(result, buildWordMap, buildPhraseMap, false);
        }
    };

    QueryResultSet.prototype.Compact = function () {
        var newResults = new Array();

        for (var i = 0; i < this.mResults.length; i++) {
            if (this.mResults[i]) {
                newResults[newResults.length] = this.mResults[i];
            }
        }

        this.mResults = newResults;
    };

    QueryResultSet.prototype.GetLength = function () {
        return this.mResults.length;
    };

    QueryResultSet.prototype.GetResult = function (i) {
        return this.mResults[i];
    };

    QueryResultSet.prototype.GetWordMap = function () {
        return this.mWordMap;
    };

    QueryResultSet.prototype.RemoveAt = function (i) {
        this.mResults[i] = null;
    };

    QueryResultSet.prototype.RemoveTopicId = function (result) {
        var topic = result.Entry.TopicID;
        var searchDB = result.SearchDB;
        var topicKey = searchDB + "_" + topic;
        var indexList = this.mTopicMap.GetItem(topicKey);

        if (indexList) {
            for (var i = 0; i < indexList.length; i++) {
                var currResult = this.mResults[indexList[i]];
                var entry = currResult.Entry;
                var wordKey = searchDB + "_" + topic + "_" + entry.Word;
                var phraseKey = currResult.ParentPhraseName + "_" + searchDB + "_" + topic + "_" + entry.Word;

                this.mWordMap.Remove(wordKey);
                this.mPhraseMap.Remove(phraseKey);
                this.mTopicMap.Remove(topicKey);

                //

                this.RemoveAt(indexList[i]);
            }
        }
    };

    QueryResultSet.prototype.ShallowClone = function (buildWordMap, buildPhraseMap, buildTopicMap) {
        var resultSet = new QueryResultSet();

        for (var i = 0; i < this.mResults.length; i++) {
            resultSet.Add(this.mResults[i], buildWordMap, buildPhraseMap, buildTopicMap);
        }

        return resultSet;
    };

    QueryResultSet.prototype.SortByRank = function () {
        this.mResults.sort(this.CompareRank);
    };

    QueryResultSet.prototype.ToDifference = function (results, buildWordMap, buildPhraseMap) {
        var newResults = this.ShallowClone(buildWordMap, buildPhraseMap, true);

        for (var i = 0; i < results.GetLength(); i++) {
            newResults.RemoveTopicId(results.GetResult(i));
        }

        newResults.Compact();

        return newResults;
    };

    QueryResultSet.prototype.ToIntersection = function (results, buildWordMap, buildPhraseMap) {
        var newResults = new QueryResultSet();
        var map1 = new MadCap.Utilities.Dictionary();
        var map2 = new MadCap.Utilities.Dictionary();

        for (var i = 0; i < this.mResults.length; i++) {
            var result = this.mResults[i];
            var key = result.SearchDB + "_" + result.Entry.TopicID;

            map1.Add(key, true);
        }

        for (var i = 0; i < results.GetLength(); i++) {
            var result = results.GetResult(i);
            var key = result.SearchDB + "_" + result.Entry.TopicID;

            map2.Add(key, true);
        }

        for (var i = 0; i < this.mResults.length; i++) {
            var result = this.mResults[i];
            var key = result.SearchDB + "_" + result.Entry.TopicID;

            if (map2.GetItem(key)) {
                newResults.Add(result, buildWordMap, buildPhraseMap, false);
            }
        }

        for (var i = 0; i < results.GetLength(); i++) {
            var key = results.GetResult(i).SearchDB + "_" + results.GetResult(i).Entry.TopicID;

            if (map1.GetItem(key)) {
                newResults.Add(results.GetResult(i), buildWordMap, buildPhraseMap, false);
            }
        }

        return newResults;
    };

    QueryResultSet.prototype.ToMerged = function () {
        var mergedSet = new QueryResultSet();
        var map = new MadCap.Utilities.Dictionary();

        for (var i = 0, length = this.mResults.length; i < length; i++) {
            var result = this.mResults[i];
            var key = result.SearchDB + "_" + this.mResults[i].Entry.TopicID;
            var item = map.GetItem(key);

            if (item) {
                item.Ranking = item.Ranking + result.Ranking;
                continue;
            }

            map.Add(key, result);
            mergedSet.Add(result, false, false, false);
        }

        return mergedSet;
    };

    QueryResultSet.prototype.ToPhrases = function (results, token, buildWordMap, buildPhraseMap) {
        if (!results) {
            var set1 = new QueryResultSet();

            return set1;
        }

        var adjacentEntries = this.FindAdjacentEntries(results, token, buildWordMap, buildPhraseMap);

        return adjacentEntries;
    };

    QueryResultSet.prototype.ToUnion = function (results, buildWordMap, buildPhraseMap) {
        this.AddAllUnique(results, buildWordMap, buildPhraseMap);
    };

    // (Should be) Private member functions

    QueryResultSet.prototype.CompareRank = function (a, b) {
        var rank1 = a.Ranking;
        var rank2 = b.Ranking;
        var ret = rank2 - rank1;

        return ret;
    }

    QueryResultSet.prototype.FindAdjacentEntries = function (results, token, buildWordMap, buildPhraseMap) {
        var newResults = new QueryResultSet();
        var wordList = Search.SplitPhrase(token.GetTokenText());
        var wordListMap = new MadCap.Utilities.Dictionary();

        for (var j = 0; j < wordList.length; j++) {
            wordListMap.Add(wordList[j], true);
        }

        var wordMap = results.GetWordMap();

        for (var i = 0; i < this.mResults.length; i++) {
            var result = this.mResults[i];
            var entry = result.Entry;
            var searchDB = result.SearchDB;
            var rank = entry.Rank;
            var topic = entry.TopicID;
            var word = entry.Word;
            var key = searchDB + "_" + topic + "_" + (parseInt(word) + 1);
            var nextResult = wordMap.GetItem(key);

            if (nextResult) {
                if (wordListMap.GetItem(nextResult.ParentPhraseName) && wordListMap.GetItem(result.ParentPhraseName)) {
                    nextResult.Ranking = result.Ranking + 10000;
                }
                else {
                    nextResult.Ranking = result.Ranking + 1000;
                }

                newResults.Add(nextResult, buildWordMap, buildPhraseMap, false);
            }
        }

        return newResults;
    }

    QueryResultSet.prototype.PromotePhrases = function (results, token) {
        var wordList = Search.SplitPhrase(token.GetTokenText());
        var wordListMap = new MadCap.Utilities.Dictionary();

        for (var j = 0; j < wordList.length; j++) {
            wordListMap.Add(wordList[j], true);
        }

        var wordMap = results.GetWordMap();

        for (var i = 0; i < this.mResults.length; i++) {
            var result = this.mResults[i];
            var entry = result.Entry;
            var searchDB = result.SearchDB;
            var rank = entry.Rank;
            var topic = entry.TopicID;
            var word = entry.Word;
            var key = searchDB + "_" + topic + "_" + (parseInt(word) - 1);
            var nextResult = wordMap.GetItem(key);

            if (nextResult) {
                if (wordListMap.GetItem(nextResult.ParentPhraseName) && wordListMap.GetItem(result.ParentPhraseName)) {
                    nextResult.Ranking = result.Ranking + 10000;
                }
                else {
                    nextResult.Ranking = result.Ranking + 1000;
                }
            }
        }
    }

    //
    //    End class QueryResultSet
    //

    Search.SplitPhrase = function (text) {
        var terms = null;
        var searchDB = MadCap.WebHelp.SearchPane.SearchDBs[0];

        if (searchDB.SearchType == "NGram") {
            terms = new Array(Math.max(0, text.length - (searchDB.NGramSize + 1)));

            for (var i = 0; i < text.length - searchDB.NGramSize + 1; i++) {
                terms[i] = text.substring(i, i + searchDB.NGramSize);
            }
        }
        else {
            terms = text.split(" ");
        }

        return terms;
    };
})();
