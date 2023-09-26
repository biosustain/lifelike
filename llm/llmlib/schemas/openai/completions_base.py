from marshmallow import fields, validate, Schema


class CompletionsBaseRequestSchema(Schema):
    timeout = fields.Float()
    max_tokens = fields.Integer()
    temperature = fields.Float(validate=validate.Range(min=0, max=2))
    top_p = fields.Float()
    n = fields.Integer()
    stream = fields.Boolean()
    logprobs = fields.Integer(
        validate=validate.Range(min=0, max=5), allow_none=True
    )
    stop = fields.List(
        fields.String(required=True), validate=validate.Length(min=0, max=4)
    )
    presence_penalty = fields.Float(validate=validate.Range(min=-2, max=2))
    frequency_penalty = fields.Float(validate=validate.Range(min=-2, max=2))
    logit_bias = fields.Dict(
        keys=fields.String(),
        values=fields.Float(validate=validate.Range(min=-100, max=100)),
    )
    user = fields.String()
