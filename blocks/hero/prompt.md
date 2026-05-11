In the child item of hero block with the variant "Hero with Thumbnail Images" which is called as Hero item add a
 select component which has 2 options:-
                1. Images
                2. BG Video
only if we select on the option images "Images" where the first field of that fields should be-  {
          "...": "../../models/elements/_image-picker.json#/imagePickerFields"
        }

and if we select on the option "BG Video"
    in the place of that field there should 2 fields
                            1. text component to add only youtube url
                            2. image picker ield to upload and select a DAM video

once you modify the code i _hero.json
run the command : npm run build:json

and in the dom structure wherever the <img>  tag is coming when we are adding images instead of that it should come with a iframe if we are authoring youtube url and if we are authoring DAM asset then it should come with a <video> tag.