/**
 * =========================================================
 * WebApp.gs
 * STEP 5A - Web App Entry
 * =========================================================
 */


function doGet() {

  return HtmlService
    .createTemplateFromFile(
      'Index'
    )
    .evaluate()
    .setTitle(
      '作業前書類 自動作成'
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}
