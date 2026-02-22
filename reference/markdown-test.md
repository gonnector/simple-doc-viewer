# 마크다운 렌더링 테스트

## 1. 텍스트 서식

일반 텍스트입니다. **굵은 글씨**, *기울임*, ***굵은 기울임***, ~~취소선~~, `인라인 코드`를 테스트합니다.

> 인용문입니다. 마크다운은 2004년 John Gruber가 만들었습니다.
>
> > 중첩된 인용문도 가능합니다.

---

## 2. 목록

### 순서 없는 목록
- 사과
- 바나나
  - 노란 바나나
  - 초록 바나나
- 딸기
  - 국내산
    - 설향
    - 금실

### 순서 있는 목록
1. 첫 번째 항목
2. 두 번째 항목
3. 세 번째 항목
   1. 하위 항목 A
   2. 하위 항목 B

### 체크리스트
- [x] 완료된 작업
- [x] 이것도 완료
- [ ] 아직 안 한 작업
- [ ] 이것도 남음

---

## 3. 코드 블록

### JavaScript
```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// 피보나치 수열 출력
for (let i = 0; i < 10; i++) {
  console.log(`F(${i}) = ${fibonacci(i)}`);
}
```

### Python
```python
class DataProcessor:
    def __init__(self, data: list[dict]):
        self.data = data

    def filter_by(self, key: str, value: any) -> list[dict]:
        """조건에 맞는 데이터를 필터링합니다."""
        return [item for item in self.data if item.get(key) == value]

    def summary(self) -> dict:
        return {
            "total": len(self.data),
            "keys": list(self.data[0].keys()) if self.data else []
        }
```

### Bash
```bash
#!/bin/bash
echo "현재 디렉토리: $(pwd)"
for file in *.md; do
    echo "마크다운 파일 발견: $file"
    wc -l "$file"
done
```

---

## 4. 테이블

| 기능 | Chrome | Firefox | Safari | Edge |
|------|:------:|:-------:|:------:|:----:|
| CSS Grid | ✅ | ✅ | ✅ | ✅ |
| WebGPU | ✅ | ⚠️ | ❌ | ✅ |
| Container Queries | ✅ | ✅ | ✅ | ✅ |
| View Transitions | ✅ | ❌ | ❌ | ✅ |

### 정렬 테스트

| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:-----------|:----------:|----------:|
| AAA | BBB | CCC |
| 긴 텍스트 예시 | 중간 | 12,345 |
| Hello | World | 99.9% |

---

## 5. 링크 & 이미지

### 링크
- [GitHub](https://github.com)
- [MDN Web Docs](https://developer.mozilla.org)
- 자동 링크: https://www.example.com

### 이미지
![Placeholder 이미지](https://via.placeholder.com/600x200/4A90D9/ffffff?text=Markdown+Rendering+Test)

---

## 6. 수학 표현 (LaTeX)

인라인 수학: $E = mc^2$

블록 수학:

$$
\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

---

## 7. 각주

마크다운은 읽기 쉬운 문서 형식입니다[^1]. HTML로 변환할 수 있습니다[^2].

[^1]: 2004년에 처음 공개되었습니다.
[^2]: 다양한 변환 라이브러리가 존재합니다.

---

## 8. 정의 목록

마크다운
: 경량 마크업 언어의 하나

HTML
: HyperText Markup Language의 약자

CSS
: Cascading Style Sheets의 약자

---

## 9. 이모지 & 특수문자

🚀 로켓 | 🎯 타겟 | 💻 컴퓨터 | 📊 차트 | ⚡ 번개 | 🔥 불꽃

특수문자: &amp; &lt; &gt; &copy; &trade; &rarr; &larr;

---

## 10. 접기/펼치기

<details>
<summary>클릭하여 펼치기</summary>

숨겨진 내용입니다. 마크다운에서 HTML 태그도 사용할 수 있습니다.

```json
{
  "name": "markdown-test",
  "version": "1.0.0",
  "description": "마크다운 렌더링 테스트 파일"
}
```

</details>

---

## 11. 하이라이트 & 키보드

==하이라이트된 텍스트== (일부 렌더러 지원)

키보드 단축키: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>

---

## 12. 수평선 스타일

위: 별표 방식

***

위: 하이픈 방식

---

위: 밑줄 방식

___

끝.
