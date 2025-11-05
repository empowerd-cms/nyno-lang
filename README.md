### Stand-alone Runtime for Executing .nyno workflow files

#### Install
Make sure [Nyno](https://github.com/empowerd-cms/nyno) is installed and running either directly on host or using container/docker/podman.

```
git clone https://github.com/empowerd-cms/nyno-lang
bun install # or npm install
npm link # for using 'nyno' command
```

#### Usage:

```
# cat cli/tests/test1.nyno 
context:
    i: 0

workflow: 
  - step: nyno-echo
    args: ["${i}"]
    next: [1,2]

  - step: nyno-echo
    args: ["the first from ${i}"]

  - step: nyno-echo 
    args: ["the second from ${i}"]
    context:
      extra: "for two"

```

## Run a .nyno file: 
```
nyno cli/tests/test1.nyno 
[{"input":{"i":0},"output":0,"details":{"command":["nyno-echo",0],"context":{"i":0},"node_id":"0","node_title":"step [0]","new_context":{"i":0,"NYNO_ECHO_ARGS":[0],"O_0":0}}},{"input":{"i":0,"NYNO_ECHO_ARGS":[0],"O_0":0},"output":"the first from 0","details":{"command":["nyno-echo","the first from 0"],"context":{"i":0,"NYNO_ECHO_ARGS":[0],"O_0":0},"node_id":"1","node_title":"step [1]","new_context":{"i":0,"NYNO_ECHO_ARGS":["the first from 0"],"O_0":0,"O_1":"the first from 0"}}}]
```

