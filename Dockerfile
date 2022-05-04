FROM mhart/alpine-node:12.22.3

COPY . . 

RUN npm i

CMD [ "node", "index.js" ]