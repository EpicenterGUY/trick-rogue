TRICK//ROGUE GitHub-ready
Open index.html in a browser. Card images are under assets/cards/.

Card data
---------
`cards.js` is the single source of truth for named-card identity, printed suit/rank,
description, terms, image, and pack membership. `pack01` is the official 10-card
new pack and uses only `assets/cards/pack01`; legacy artwork remains preserved.

Duplicate cleanup
-----------------
The former NAMED object was assigned repeatedly, so JavaScript kept the last
assignment for duplicate base keys. The unified definitions preserve exactly those
previously-live winners:

- S2 빙결 수정 (replaced 멸망 버튼)
- S4 그림자 단검 (replaced 화약 냄새)
- S6 강철 톱니 (replaced 오버클럭 코어)
- S8 심연 거울 (replaced 절단선)
- S10 황금 망원경 (replaced 폭주 기관차)
- SQ 얼음 여왕 (replaced 규칙을 읽지 않은 자의 최후)
- H2 촛불 (replaced 길고양이)
- H3 새벽 깃털 (replaced 삼각김밥 유통기한 3분 전)
- H6 약초 주머니 (replaced 우산 없는 날)
- H7 연심 나침반 (replaced 알람 7개)
- H10 축복의 종 (replaced 심폐소생술)
- HQ 장미 여왕 (replaced 심장 박동기)
- D2 별 병약 (replaced 고장난 자판기)
- D4 탐험 지도 (replaced 정품보증서)

Run `npm test` to validate pack size, unique card IDs, image files, and terms.
