// https://new.chunithm-net.com/chuni-mobile/html/mobile/ranking/teamPoint/

(function() {
  // ページ全体の HTML を取得
  const html = document.documentElement.outerHTML;

  // Blob オブジェクトを作成（文字コードは UTF-8）
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

  // ダウンロード用のリンクを作成
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  const date = yesterday.toISOString().slice(0, 10);
  a.href = url;
  a.download = `team_point_${date}.html`;

  // 一時的にリンクをクリックしてダウンロード実行
  document.body.appendChild(a);
  a.click();

  // クリーンアップ
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
})();