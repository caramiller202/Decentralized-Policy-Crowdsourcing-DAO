(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-TITLE u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-INVALID-CATEGORY u103)
(define-constant ERR-INVALID-TAGS u104)
(define-constant ERR-INVALID-VOTING-DEADLINE u105)
(define-constant ERR-PROPOSAL-ALREADY-EXISTS u106)
(define-constant ERR-PROPOSAL-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-VOTES u110)
(define-constant ERR-INVALID-QUORUM u111)
(define-constant ERR-PROPOSAL-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-PROPOSALS-EXCEEDED u114)
(define-constant ERR-INVALID-PROPOSAL-TYPE u115)
(define-constant ERR-INVALID-IMPACT-RATING u116)
(define-constant ERR-INVALID-BUDGET-REQUEST u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-STATUS u119)
(define-constant ERR-INVALID-TAG-LENGTH u120)

(define-data-var next-proposal-id uint u0)
(define-data-var max-proposals uint u1000)
(define-data-var creation-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map proposals
  uint
  {
    title: (string-utf8 100),
    description: (string-utf8 500),
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20)),
    voting-deadline: uint,
    min-votes: uint,
    quorum: uint,
    timestamp: uint,
    creator: principal,
    proposal-type: (string-utf8 50),
    impact-rating: uint,
    budget-request: uint,
    location: (string-utf8 100),
    status: bool
  }
)

(define-map proposals-by-title
  (string-utf8 100)
  uint)

(define-map proposal-updates
  uint
  {
    update-title: (string-utf8 100),
    update-description: (string-utf8 500),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)

(define-read-only (get-proposal-updates (id uint))
  (map-get? proposal-updates id)
)

(define-read-only (is-proposal-registered (title (string-utf8 100)))
  (is-some (map-get? proposals-by-title title))
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (and (> (len cat) u0) (<= (len cat) u50))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-tags (tags (list 10 (string-utf8 20))))
  (if (and (<= (len tags) u10) (fold check-tag-length tags true))
      (ok true)
      (err ERR-INVALID-TAGS))
)

(define-private (check-tag-length (tag (string-utf8 20)) (acc bool))
  (and acc (> (len tag) u0) (<= (len tag) u20))
)

(define-private (validate-voting-deadline (deadline uint))
  (if (> deadline block-height)
      (ok true)
      (err ERR-INVALID-VOTING-DEADLINE))
)

(define-private (validate-min-votes (votes uint))
  (if (> votes u0)
      (ok true)
      (err ERR-INVALID-MIN-VOTES))
)

(define-private (validate-quorum (quorum uint))
  (if (and (> quorum u0) (<= quorum u100))
      (ok true)
      (err ERR-INVALID-QUORUM))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-proposal-type (type (string-utf8 50)))
  (if (or (is-eq type "policy") (is-eq type "funding") (is-eq type "governance"))
      (ok true)
      (err ERR-INVALID-PROPOSAL-TYPE))
)

(define-private (validate-impact-rating (rating uint))
  (if (<= rating u10)
      (ok true)
      (err ERR-INVALID-IMPACT-RATING))
)

(define-private (validate-budget-request (budget uint))
  (if (>= budget u0)
      (ok true)
      (err ERR-INVALID-BUDGET-REQUEST))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-proposals (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-PROPOSALS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-proposals new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-proposal
  (title (string-utf8 100))
  (description (string-utf8 500))
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20)))
  (voting-deadline uint)
  (min-votes uint)
  (quorum uint)
  (proposal-type (string-utf8 50))
  (impact-rating uint)
  (budget-request uint)
  (location (string-utf8 100))
)
  (let (
        (next-id (var-get next-proposal-id))
        (current-max (var-get max-proposals))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PROPOSALS-EXCEEDED))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-category category))
    (try! (validate-tags tags))
    (try! (validate-voting-deadline voting-deadline))
    (try! (validate-min-votes min-votes))
    (try! (validate-quorum quorum))
    (try! (validate-proposal-type proposal-type))
    (try! (validate-impact-rating impact-rating))
    (try! (validate-budget-request budget-request))
    (try! (validate-location location))
    (asserts! (is-none (map-get? proposals-by-title title)) (err ERR-PROPOSAL-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set proposals next-id
      {
        title: title,
        description: description,
        category: category,
        tags: tags,
        voting-deadline: voting-deadline,
        min-votes: min-votes,
        quorum: quorum,
        timestamp: block-height,
        creator: tx-sender,
        proposal-type: proposal-type,
        impact-rating: impact-rating,
        budget-request: budget-request,
        location: location,
        status: true
      }
    )
    (map-set proposals-by-title title next-id)
    (var-set next-proposal-id (+ next-id u1))
    (print { event: "proposal-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-proposal
  (proposal-id uint)
  (update-title (string-utf8 100))
  (update-description (string-utf8 500))
)
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get creator p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (let ((existing (map-get? proposals-by-title update-title)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id proposal-id) (err ERR-PROPOSAL-ALREADY-EXISTS))
              (begin true)
            )
          )
          (let ((old-title (get title p)))
            (if (is-eq old-title update-title)
                (ok true)
                (begin
                  (map-delete proposals-by-title old-title)
                  (map-set proposals-by-title update-title proposal-id)
                  (ok true)
                )
            )
          )
          (map-set proposals proposal-id
            {
              title: update-title,
              description: update-description,
              category: (get category p),
              tags: (get tags p),
              voting-deadline: (get voting-deadline p),
              min-votes: (get min-votes p),
              quorum: (get quorum p),
              timestamp: block-height,
              creator: (get creator p),
              proposal-type: (get proposal-type p),
              impact-rating: (get impact-rating p),
              budget-request: (get budget-request p),
              location: (get location p),
              status: (get status p)
            }
          )
          (map-set proposal-updates proposal-id
            {
              update-title: update-title,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "proposal-updated", id: proposal-id })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (get-proposal-count)
  (ok (var-get next-proposal-id))
)

(define-public (check-proposal-existence (title (string-utf8 100)))
  (ok (is-proposal-registered title))
)