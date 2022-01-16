                /**
                 * Http2 Stream example
                 * None Working at present
                 */
                 const stream = new ReadableStream({
                    start(controller) {
                      // Die folgende Funktion behandelt jeden Daten-Chunk
                      // @ts-ignore
                      recorder.port.onmessage = (ev) => { 
                            controller.close();
                            controller.enqueue(ev.data);
                      }; 
                      
                    }
                  });

                const { readable, writable } = new TransformStream();
                const inputSocket = writable.getWriter();
                
                const responsePromise = fetch(httpUrl, {
                    method: 'POST',
                    body: readable,
                    allowHTTP1ForStreamingUpload: true,
                }).catch(event=>{
                    inputStatus.innerHTML = `<span style="color: red;">ERROR: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled','')
                }).then((event)=>{
                    inputStatus.innerHTML = `<span style="color: brown;">CLOSED: ${JSON.stringify(event)}</span>`;
                    micButton.removeAttribute("disabled");
                    micButton.setAttribute('enabled', '')
                });