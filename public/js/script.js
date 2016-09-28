//inject angular file upload directives and services.
var app = angular.module('rdfImporter', [
  'cgBusy',
  'ngSanitize',
  'ui.grid',
  'ui.grid.cellNav',
  'ui.grid.edit',
  // 'ui.grid.selection',
  'ui.grid.resizeColumns',
  // 'ui.grid.pinning',
  // 'ui.grid.moveColumns',
  // 'ui.grid.exporter',
  // 'ui.grid.grouping',
  'ui.grid.pagination',
  'ui.grid.autoResize'
  ]);

app.controller('MyCtrl', ['$scope', '$http', '$timeout','uiGridConstants', function($scope, $http, $timeout,uiGridConstants) {
  
  // $scope.$watch('gridOptions1.paginationPageSize',function(n,o){
  //   console.log(n,o);
  //   $scope.gridOptions1.minRowsToShow = n;
  // });

  // id,file,deployment,graph,date,ip
  $scope.gridOptions1 = {
    enableColumnResizing: true,
    enableFiltering: true,
    enableCellEdit:true,
    paginationPageSizes: [10, 50, 100],
    paginationPageSize: 10,
    columnDefs: [{
      name: 'id',
      width: 50
    },{
      name: 'file',
    }, {
      name: 'deployment',
      width: 80
    }, {
      name: 'graph',
      width: 80
    }, {
      name: 'date',
      sort: {
        direction: uiGridConstants.DESC,
        priority: 0,
      },
      width: 130,
      cellTemplate: '<div class="ui-grid-cell-contents">{{grid.appScope.makeDate(row.entity.date)}}</div>'
    }, {
      name: 'urls',
      displayName: 'Url / Log',
      enableFiltering: false,
      enableColumnMenu: false,
      cellTemplate: '<div class="ui-grid-cell-contents">' +
        '<a class="btn btn-xs btn-primary" target="_blank" ng-href="/uploads/{{row.entity.file}}.xlsx"><i class="glyphicon glyphicon-file"></i></a> ' +
        '<a class="btn btn-xs btn-warning" target="_blank" ng-href="/uploads/{{row.entity.file}}_log.txt"><i class="glyphicon glyphicon-wrench"></i></a> ' +
        '</div>',
      width: 80

    }]
  };
  
  $scope.makeDate = function (str){
    var d = new Date(str);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)+" "+ ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" +
    d.getFullYear().toString().slice(2);
  }

  $scope.addAlert = function(message) {
    $scope.message=message;
    $timeout(function(){$scope.message=null;},12000);
  }

  $scope.fetchHistory = function() {
    $scope.loading=$http.get('/history').then(function(result) {
      console.log(result.data);
      $scope.gridOptions1.data = result.data;
    });
  };
  $scope.fetchHistory();

  var currentFile = "";
  $('.upload-btn').on('click', function() {
    $('#upload-input').click();
    $('.progress-bar').text('0%');
    $('.progress-bar').width('0%');
  });

  $('#import_btn').on('click', function() {
    $(".loading").show(500);
    var selectedGraph = $("#graph").val();
    var selectedDeployment = $("#deployment").val();
    console.log(selectedGraph)
    $.get('/import?graph=' + selectedGraph + '&file=' + currentFile + '&deployment=' + selectedDeployment, null, function(res) {
      console.log(res);
      $timeout(function() {
        $scope.fetchHistory()
      }, 500);
      $(".loading").hide(500);
      $scope.addAlert(res.replace(/\n/g, "<br />"));
    })
  });

  $('#upload-input').on('change', function() {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      var formData = new FormData();
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var ext = file.name.slice(file.name.lastIndexOf(".") + 1);
        if (ext !== "xls" && ext !== "xlsx") {
          window.alert("Only .xls or .xlsx files are allowed, not " + ext);
          return false;
        }
        else formData.append('uploads[]', file, file.name);
        $scope.ext = ext;
      }
      $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(data) {
          currentFile = data.split(":")[1].split('.xls')[0];
          $('.progress-bar').html(currentFile + '.' + $scope.ext);
          $('.import').show(500);
        },
        xhr: function() {
          var xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', function(evt) {
            if (evt.lengthComputable) {
              var percentComplete = evt.loaded / evt.total;
              percentComplete = parseInt(percentComplete * 100);
              $('.progress-bar').text(percentComplete + '%');
              $('.progress-bar').width(percentComplete + '%');
              if (percentComplete === 100) {}
            }
          }, false);
          return xhr;
        }
      });

    }
  });

}]);