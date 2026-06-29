// --- Navigation ---
function navigateTo(dirPath, onDone) {
  $search.value = '';
  state.searchQuery = '';
  apiList(dirPath, function(data) {
    if (data.error) {
      // Access denied — try chroot to expand ROOT_DIR
      apiChroot(dirPath, function(cr) {
        if (cr && cr.root) {
          apiList(dirPath, function(data2) {
            if (data2.error) return;
            state.currentPath = data2.path;
            state.parentPath = data2.parent;
            state.items = data2.items;
            $pathBadge.textContent = data2.path;
            $pathBadge.title = data2.path;
            renderTree();
            if (onDone) onDone();
          });
        }
      });
      return;
    }
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
    if (onDone) onDone();
  });
}

// 새로고침 — 현재 디렉토리(또는 활성 검색)를 재나열. navigateTo와 달리 검색을 비우지 않음.
function refreshTree() {
  if ($tree && $tree.querySelector('.rename-input')) return; // 이름변경 입력 중이면 트리 보존
  if (state.searchQuery) {
    doSearch(state.searchQuery); // 검색 모드: 결과 재조회 (스크롤은 best-effort)
    return;
  }
  var sc = $tree ? $tree.scrollTop : 0;
  apiList(state.currentPath, function (data) {
    if (data.error) return; // 현재 폴더가 외부 삭제 등으로 접근 불가 시 트리 유지
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
    if ($tree) $tree.scrollTop = sc; // 스크롤 복원 (선택 .selected는 activeTab 기반이라 자동 보존)
  });
}

