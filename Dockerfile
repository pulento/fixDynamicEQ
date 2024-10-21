# Run: docker run -it --net=host -d pulento/fixDynamicEQ
# User --net=host since we need multicast
FROM node:18-alpine

ENV ADY_DIRECTORY=/usr/src/app/rew/

# Create app directory
WORKDIR /usr/src/app

# Install utility packages
RUN apk update && apk upgrade && \
    apk add --no-cache bash openssh

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)

# Copy App
COPY . .

# Start
RUN npm install
# If you are building your code for production
# RUN npm install --only=production

EXPOSE 3000
CMD [ "npm", "run", "start" ]
