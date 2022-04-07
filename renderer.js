const remote = require('electron').remote;

const fadeTime = 300;

// nodeIntegration:true だと使えない問題の対策
window.jQuery = window.$ = require('./node_modules/jquery/dist/jquery');

const fs = require('fs');
const path = require('path');
const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);

var el = document.querySelector('.image-list');
Sortable.create(el, {
    animation: 150,
});

const is_windows = process.platform==='win32';
// const is_mac = process.platform==='darwin';

//--------------------------------------
// 設定ファイルのロード
//--------------------------------------

function loadConfig() {
    storage.get(configFileName, function(err, data){
        if(err) throw err;
        appConfig = data;

        // 設定ファイルがなければデフォルトの設定ファイルを作成
        if(!Object.keys(appConfig).length){
            const defaultConfigFile = path.join(__dirname, 'app-config.json');
            fs.readFile(defaultConfigFile, 'utf-8', (err,data) => {
                if (err) throw err;
                appConfig = JSON.parse(data);
                
                storage.set(configFileName, appConfig, function(err){
                    if(err) throw err;
                });
            })
        }

        console.log(appConfig);
    });

}

const storage = require('electron-json-storage');
const configFileName = 'app-config.json'
var appConfig = {};
loadConfig();

//--------------------------------------
// ドラッグ&ドロップ処理
//--------------------------------------

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(e.dataTransfer.files);
    loadFile(e.dataTransfer.files);
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

function loadFile (files) {
    $('.receiving-box-outer').hide();
    $('.container-btn').fadeIn(fadeTime);

    addImagesToList(files);

    // 縦モードの設定
    if (appConfig.yModeDefault) {
        $('#xyToggleBtn').addClass('mode-y');
        $('.container-image').addClass('mode-y');
        $('.image-box').addClass('mode-y');
        $('.image').addClass('mode-y');
    }

    // 出力先の設定を促す
    if(!appConfig.outputPath){
        $('#configBtn').click();
    }
}


function addImagesToList(imagesArr) {

    for (const f of imagesArr) {

        // 画像の生成
        const item = document.createElement('div');
        item.classList.add('image-box');
        if($('#xyToggleBtn').hasClass('mode-y')){
            item.classList.add('mode-y');
        }

        const note = document.createElement('div');
        note.classList.add('note');

        const imgDiv = document.createElement('div');
        imgDiv.classList.add('image-div');

        const img = document.createElement('img');
        img.classList.add('image');
        img.src = f.path;
        if($('#xyToggleBtn').hasClass('mode-y')){
            img.classList.add('mode-y');
        }

        //閉じるボタン生成
        const remove = document.createElement('div');
        remove.classList.add('remove-btn');

        item.append(note);
        imgDiv.append(img);
        imgDiv.append(remove);
        item.append(imgDiv);

        // テキストボックス生成
        const form = document.createElement('form');
        form.classList.add('input-form');

        const inputbox = document.createElement('input');
        inputbox.classList.add('input-box');

        const datalist = document.createElement('datalist');
        datalist.setAttribute('id','textlist');

        const suggestListSum = appConfig.suggestListPair.concat(appConfig.suggestList)

        for (var i=0;i<suggestListSum.length;i++){
            const data = document.createElement('option');
            data.value = suggestListSum[i];
            datalist.append(data);
        }

        form.append(inputbox);
        form.append(datalist);
        note.append(form);

        $(item).appendTo('.image-list').hide().fadeIn(fadeTime);
    }  // for

    // テキストボックスに属性を付与
    $('.input-box').attr({
        'type': 'search',
        'list': 'textlist',
        'placeholder': '✎',
        'autocomplete': 'off'
    }).on('blur', function(){
        // ペア入力候補をチェックして反映
        if($(this).val()){
            setPairSuggest();
        }
    }).css('color', '#' + appConfig.userFontColor);

    // 画像クリックでテキストボックスにフォーカス
    $('.image').on('click', function(){
        const index = $('.image').index(this);
        $('.input-box').eq(index).focus();
    })

    // ×ボタンクリックで画像削除
    $('.remove-btn').on('click', function(){
        if ($('.image-box').length != 1){
            const index = $('.remove-btn').index(this);
            const target = $('.image-box').eq(index);

            target.fadeOut(fadeTime);
            setTimeout(function(){
                target.remove();
            },fadeTime);
        } else {
            $('#trashBtn').click()
        }

    })

    // フォントサイズをリセット
    $('.input-box').css('font-size', '27px');
    $('.note').css('height', '45px');

    // すべて投入終えたら表示
    $('.container-image').fadeIn(fadeTime);
}

// Dockにドロップされたファイルを受ける
const { ipcRenderer } = require('electron');
ipcRenderer.on('dropToAppIcon', (e, filePath) => {
    const win = remote.getCurrentWindow();
    win.focus();

    console.log(filePath);

    // 設定ファイルがロードできていない場合は読み込まない
    if(Object.keys(appConfig).length){
        const fileList = [{
            path: filePath
        }]
        loadFile(fileList)
    }

})

//--------------------------------------
// クリック処理
//--------------------------------------

// 保存ボタンクリック
$('#saveBtn').on('click', function() {

    // 出力先が未設定の場合は設定画面を表示
    if (!appConfig.outputPath){
        if(!appConfig.outputPath){
            $('#configBtn').click();
        }
        return false;
    }

    // 不要なパーツを一時的に非表示
    const notes = document.querySelectorAll('.input-box')
    notes.forEach(n => {
        if (!n.value){
            n.style.display="none";
        }
    });
    $('.remove-btn').hide()

    // 拡大率　縦横どちらのモードかで可変
    const expRateList = {
        "x": {
            "default": "1.6",
            "small": "1.0"
        },
        "y": {
            "default": "1.1",
            "small": "0.7"
        }
    };
    if (appConfig.yModeDefault){
        xyMode = "y";
    } else {
        xyMode = "x";
    }
    const expRate = expRateList[xyMode][appConfig.outputSize];

    // 出力用に拡大
    $('.image-list').css('transform', 'scale('+ expRate +')')

    // 撮影
    html2canvas(document.querySelector('.image-list')).then(canvas => {
        //データ保存
        const saveFileName = saveCanves(canvas);

        // 保存後に画像を開く
        if(appConfig.openImgAfterSave){
            if (is_windows) {
                exec('explorer ' + appConfig.outputPath + '\\' + saveFileName);
            } else {
                exec('open ' + appConfig.outputPath + '/' + saveFileName);
            }
        }
    });

    // パーツ再表示
    $('.input-box').show();
    $('.remove-btn').show();

    // 拡大を元に戻す
    $('.image-list').css('transform', 'scale(1.0)')

    // 横モードに戻す
    $('.container-image').removeClass('mode-y');
    $('#xyToggleBtn').removeClass('mode-y');

    // 保存後に画像をクリア
    if(appConfig.clearAppAfterSave){
        clearImages();
    }
    
});

// 画像リストの初期化処理
function clearImages() {
    $('.image-box').remove();
    $('.container-image').hide();
    $('.container-btn').hide();
    $('.receiving-box-outer').hide().fadeIn(fadeTime+200);
}

// ゴミ箱ボタンクリック
$('#trashBtn').on('click', function() {
    clearImages();
})

// フォルダ開くボタンクリック
$('#openFolderBtn').on('click',function(){
    // 出力先が未設定の場合は設定画面を表示
    if (!appConfig.outputPath){
        if(!appConfig.outputPath){
            $('#configBtn').click();
        }
        return false;
    }

    if(is_windows) {
        exec('explorer ' + appConfig.outputPath);
    } else {
        exec('open ' + appConfig.outputPath);
    }
})

// 縦横切り替えボタンクリック
$('#xyToggleBtn').on('click', function(){
    $(this).toggleClass('mode-y');
    $('.container-image').toggleClass('mode-y');
    $('.image-box').toggleClass('mode-y');
    $('.image').toggleClass('mode-y');

    // 縦横の設定を保存
    appConfig.yModeDefault = !appConfig.yModeDefault;
    saveConfig();

})

// コメント表示・非表示ボタンクリック
$('#commentToggleBtn').on('click', function(){
    $(this).toggleClass('mode-comment-off');
    $('.note').toggleClass('mode-comment-off');
    $('.image').toggleClass('mode-comment-off');
    $('.remove-btn').toggleClass('mode-comment-off');
})

// フォント縮小ボタンクリック
$('#fontMinimizeBtn').on('click', function(){
    const textBox = $('.input-box');
    const noteBox = $('.note');
    const currentFontSize = Number(textBox.css('font-size').slice(0,-2));
    const currentBoxHeight = Number(noteBox.css('height').slice(0,-2));
    if(currentFontSize > 15){
        textBox.css('font-size', currentFontSize - 4 + 'px');
        noteBox.css('height', currentBoxHeight - 4 + 'px');
    } else {
        textBox.css('font-size', '27px');
        noteBox.css('height', '45px');
    }
    
})

// ペア入力候補機能
function setPairSuggest() {

    // 入力済みテキストを配列化
    const texts = Array.from(document.querySelectorAll('.input-box')).map(function(el){
        return el.value;
    });
    const pair = appConfig.suggestListPair;

    // ペアの適用
    if(texts.length == 2){
        if (texts.includes(pair[0]) && texts.includes("")) {
            $('.input-box').eq(texts.indexOf("")).val(pair[1]);
        } else if (texts.includes(pair[1]) && texts.includes("")) {
            $('.input-box').eq(texts.indexOf("")).val(pair[0]);
        }
    }
}

//--------------------------------------
// 保存処理
//--------------------------------------

function saveCanves (c) {
    const outputPath = appConfig.outputPath;

    const date = new Date();
    const Y = date.getFullYear();
    const M = ('00' + (date.getMonth()+1)).slice(-2);
    const D = ('00' + date.getDate()).slice(-2);
    const h = ('00' + date.getHours()).slice(-2);
    const m = ('00' + date.getMinutes()).slice(-2);
    const s = ('00' + date.getSeconds()).slice(-2);
    const saveTime = Y + M + D + h + m + s;
    const saveFileName = 'screenshot_edit_' + saveTime + '.png'

    const canvasDataUrl = c.toDataURL('image/png');
    const base64data = canvasDataUrl.replace(/^data:image\/png;base64,/, "");
    
    fs.writeFile(outputPath + '/' + saveFileName, base64data, 'base64', (err) => {
        if (err) {
            window.alert('ファイル保存に失敗しました')
            console.log(err)
        } else {
            // window.alert('ファイルを保存しました')
            $('#footter-success-title').text('Saved!');
            $('#footer-success-text').text(saveFileName);
            $('#footer-success').show().delay(2000).fadeOut(1500);
        }
    });

    return saveFileName;
}


function saveConfig () {

    storage.set(configFileName, appConfig, function(err){
        if(err) throw err;
    });

}

//--------------------------------------
// 設定画面
//--------------------------------------

// モーダル開く
$('#configBtn').on('click',function(){

    // 毎回1番目のタブをアクティブ
    $('.nav-link.active').removeClass('active');
    $('.nav-link').eq(0).addClass('active');
    $('.modal__tab.active').removeClass('active');
    $('.modal__tab').eq(0).addClass('active');

    // 設定タブ切り替え
    $('.nav-link').on('click',function(){
        const index = $('.nav-link').index(this);

        // タブ表示
        $('.nav-link.active').removeClass('active');
        $('.nav-link').eq(index).addClass('active');

        // コンテンツエリア
        $('.modal__tab.active').removeClass('active');
        $('.modal__tab').eq(index).addClass('active');
    })

    // 設定項目の反映
    $('#outputPath').val(appConfig.outputPath);
    $('input:radio[name="outputSize"]').val([appConfig.outputSize]);
    $('#openImgAfterSave').prop('checked', appConfig.openImgAfterSave);
    $('#clearAppAfterSave').prop('checked', appConfig.clearAppAfterSave);
    $('#suggestListPair1').val(appConfig.suggestListPair[0]);
    $('#suggestListPair2').val(appConfig.suggestListPair[1]);
    $('#suggestList').val(appConfig.suggestList.join('\n'));
    $('#userFontColor').val(appConfig.userFontColor);

    // 通知は隠す
    $('#suggestList-notify').hide();

    // 出力先フォルダ未設定エラー表示
    if($('#outputPath').val() == ""){
        $('#outputPath').addClass('is-invalid');
        $('#outputPath-notify').show();
    }

    $('.modal').fadeIn();

    return false;
});

// モーダル閉じる
$('.modal-close').on('click',function(){
    $('.modal').fadeOut();
    return false;
});

//--------------------------------------
// 設定変更時の保存処理
//--------------------------------------

// 保存先フォルダ
$('#outputPath').on('click', function() {
    // remoteでrequieする必要がある
    const {dialog} = require('electron').remote;
    
    var outputPath = dialog.showOpenDialogSync({
            properties: ['openDirectory'],
            title: '出力先フォルダ選択',
            defaultPath: "."
        });
    
    if(outputPath[0]){
        $(this).val(outputPath[0]);
        appConfig.outputPath = outputPath[0];
        saveConfig();

        // エラー表示消す
        $('#outputPath').removeClass('is-invalid');
        $('#outputPath-notify').hide();
    }

});

// 出力画像サイズ
$('input:radio[name="outputSize"]').on('change', function(){
    appConfig.outputSize = $('input:radio[name="outputSize"]:checked').val();
    saveConfig();
})

// 保存後プロセス
$('#openImgAfterSave').on('change', function(){
    appConfig.openImgAfterSave = $(this).prop('checked');
    saveConfig();
})
$('#clearAppAfterSave').on('change', function(){
    appConfig.clearAppAfterSave = $(this).prop('checked');
    saveConfig();
})

// ペア入力候補
$('#suggestListPair1').on('blur', function(){
    if(appConfig.suggestListPair[0] != $(this).val()){
        appConfig.suggestListPair[0] = $(this).val();
        saveConfig();
        $('#suggestListPair-notify').fadeIn();
    }
})
$('#suggestListPair2').on('blur', function(){
    if(appConfig.suggestListPair[1] != $(this).val()){
        appConfig.suggestListPair[1] = $(this).val();
        saveConfig();
        $('#suggestListPair-notify').fadeIn();
    }
})

// その他の入力候補
$('#suggestList').on('blur', function(){
    if (appConfig.suggestList.join('\n') != $(this).val()){
        appConfig.suggestList = $(this).val().split('\n');
        saveConfig();
        $('#suggestList-notify').fadeIn();
    }
})

// フォントの色
function setUserFontColor(color){
    // 文字色は空白でも保存する
    appConfig.userFontColor = $('#userFontColor').val();
    saveConfig();

    // 即時反映
    if (color) {
        $('.input-box').css('color', '#' + color);
    } else {
        $('.input-box').css('color', '#444444');
    }
    
}

$('#userFontColor').on('blur', function(){
    const color = $('#userFontColor').val();

    if (color) {
        setUserFontColor(color);
    } else {
        setUserFontColor('444444');
    }

})

// フォント設定：黒
$('#userFontColor-setBlack').on('click', function(){
    const def = '';
    $('#userFontColor').val(def);
    setUserFontColor(def);
})
// フォント設定：赤
$('#userFontColor-setRed').on('click', function(){
    const def = 'ff0000';
    $('#userFontColor').val(def);
    setUserFontColor(def);
})
// フォント設定：青
$('#userFontColor-setBlue').on('click', function(){
    const def = '007bff';
    $('#userFontColor').val(def);
    setUserFontColor(def);
})
