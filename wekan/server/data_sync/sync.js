//curl -D- -u benjamin.crouzier:morebabyplease -X GET -H "Content-Type: application/json" ""

function extractJt(str) {
  var r1 = R.trim(str).match(/^remotes\/origin\/(jt-[0-9]+)/);
  var r2 = R.trim(str).match(/^(jt-[0-9]+)/);
  return (r1 && R.toUpper(r1[1])) || (r2 && R.toUpper(r2[1]));
}

Meteor.methods({
  syncCards: function () {
    //result.data.issues.length
    //var url = 'https://jobteaser.atlassian.net/rest/api/2/search?jql=sprint IN openSprints()&project=JT&&maxResults=10000&fields=';
    //url += 'summary,description,status,assignee';

    var url = 'https://jobteaser.atlassian.net/rest/api/2/search?jql=filter=11701&&maxResults=10000&fields=';
    url += 'summary,description,status,assignee';
    var issues = Meteor.http.get(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      'auth': 'benjamin.crouzier:morebabyplease'
    });

    var board = Boards.findOne({title: 'JT'});

    issues.data.issues.forEach(function (issue) {
      var title = issue.fields.summary;
      var list = Lists.findOne({title: issue.fields.status.name});
      console.log('finding list with name:', issue.fields.status.name);

      if (!list) return;
      Cards.remove({title: title});
      var card_id = Cards.insert({
        title: title,
        description: issue.fields.description,
        boardId: board._id,
        listId: list._id,
        jiraId: issue.key,
        jiraBoardType: 'maintenance',
      }, {
        validate: false,
      });
    });
  },

  syncLists: function () {
    // board
    var board = Boards.findOne({title: 'JT'});
    if (!board) {
      var board_id = Boards.insert({title: 'JT'}, {validate: false});
      board = Boards.findOne(board_id);
    }

    //lists
    var lists = ['Open',
      'In Development',
      'In Review',
      'In Functional Review',
      'Ready for Release',
      'Released',
      'Closed'
    ];
    lists.forEach(function (title) {
      var existing = Lists.findOne({title: title, boardId: board._id});
      if (!existing) {
        Lists.insert({title: title, boardId: board._id}, {validate: false});
      }
    });
  },

  syncGit: function() {
    var exec = Meteor.require('child_process').exec;
    var cmd = Meteor.wrapAsync(exec);
    var cwd = '/Users/pinouchon/code/jobteaser/jobteaser';
    cmd('git fetch', {cwd: cwd});
    cmd('git checkout staging', {cwd: cwd});
    cmd('git pull --all', {cwd: cwd});
    cmd('git checkout develop', {cwd: cwd});
    cmd('git pull --all', {cwd: cwd});
    var branchesDevelop = cmd('git branch -a --merged develop', {cwd: cwd});
    var branchesStaging = cmd('git branch -a --merged staging', {cwd: cwd});
    //var branchesMaster = cmd('git branch -a --merged master', {cwd: cwd});

    function jiraIdsFromBranches(branches) {
      return R.uniq(branches.split('\n').map(extractJt)).filter(R.identity);
    }

    var inDevelop = jiraIdsFromBranches(branchesDevelop);
    var inStaging = jiraIdsFromBranches(branchesStaging);
    //var inMaster = jiraIdsFromBranches(branchesMaster);

    Cards.update({}, {$set: {inStaging: false}}, {validate: false, multi: true});
    Cards.update({jiraId: {$in: inStaging}}, {$set: {inStaging: true}}, {multi: true});
    Cards.update({}, {$set: {inDevelop: false}}, {validate: false, multi: true});
    Cards.update({jiraId: {$in: inDevelop}}, {$set: {inDevelop: true}}, {multi: true});
    //Cards.update({}, {$set: {inMaster: false}}, {validate: false, multi: true});
    //Cards.update({jiraId: {$in: inMaster}}, {$set: {inSMaster: true}}, {multi: true});
  },

  syncCI: function() {
    var token = 'circle-token=53f453ef44de0a2bf0db654417c7281cc4ffd160';
    var url = 'https://circleci.com/api/v1/recent-builds?' + token + '&limit=30';
    var ciResponse = Meteor.http.get(url, {headers: {'Accept': 'application/json'}});
    if (ciResponse.statusCode == 200) {
      var done = [];
      var json = JSON.parse(ciResponse.content);
      json.forEach(function(build) {
        var jiraId = extractJt(build.branch);
        if (jiraId && !R.contains(jiraId, done)) {
          Cards.update({jiraId: jiraId}, {$set: {buildStatus: build.status}}, {validate: false});
          done.push(jiraId);
        }
      });
    } else {
      console.log('Error with CI api');
      return 'Error with CI api'
    }
  }
});


function sync() {
  //var url = "#{API_URL_PREFIX}#{url_suffix}";
  //var API_URL_PREFIX = 'https://jobteaser.atlassian.net/rest/api/2/issue/';
  //var API_PORT = 443
  //
  //var headers = {
  //  'Content-Type': 'application/json'
  //};
  //
  //var params = DEFAULT_PARAMS.merge({});
  //
  //var credentials = {
  //  username: username,
  //  password: password
  //};


  //R.uniq(
  //    R.map(R.pipe(R.prop('fields'), R.prop('status')),
  //        issues.data.issues).
  //        map(n=>n.name));
  //
  //R.uniq(
  //    issues.data.issues.
  //        map(R.pipe(R.prop('fields'), R.prop('status'))).
  //        map(R.prop('name')));
}
