# Baseline

`index.html` is copied from `kmtshn/ColorQRcode` commit
`0ad37889ee9cbda0354bb3afea03b5a23f9f2167`, before scanner modifications.
The original application is tested without changing its codec or image processing.
The harness injects a Canvas with videoWidth/videoHeight properties, matching the
video input interface used by the original scanner. Service workers are blocked
in benchmark contexts. Do not replace this snapshot with the improved app.
